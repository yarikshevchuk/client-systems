import json
import os
import re
import urllib.request
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import db
from access import get_course, get_material, manage_course
from auth import current_user

router = APIRouter(prefix="/api")

NOT_FOUND = "Немає в матеріалах курсу"
DAILY_LIMIT = int(os.environ.get("AI_DAILY_LIMIT", "30"))

STOP_WORDS = {
    "the", "and", "for", "what", "how", "why", "when", "does", "this", "that", "with", "from", "are", "was",
    "about", "can", "you", "explain", "tell", "give", "show", "mean", "means", "which", "where", "who",
    "що", "таке", "як", "чому", "коли", "це", "для", "про", "або", "чи", "які", "який", "яка", "мені",
    "розкажи", "поясни", "означає", "такі", "яке", "чим", "яких",
}


class SettingsIn(BaseModel):
    summaries_on: bool
    ask_on: bool
    flashcards_on: bool


class QuestionIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


def post_json(url, headers, payload):
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"content-type": "application/json", **headers})
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)


def call_llm(system, user):
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    try:
        if anthropic_key:
            data = post_json(
                "https://api.anthropic.com/v1/messages",
                {"x-api-key": anthropic_key, "anthropic-version": "2023-06-01"},
                {"model": os.environ.get("AI_MODEL", "claude-sonnet-5-5"), "max_tokens": 900, "system": system,
                 "messages": [{"role": "user", "content": user}]})
            return data["content"][0]["text"].strip()
        if gemini_key:
            model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
            data = post_json(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                {"x-goog-api-key": gemini_key},
                {"systemInstruction": {"parts": [{"text": system}]},
                 "contents": [{"role": "user", "parts": [{"text": user}]}]})
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None
    return None


def sentences(text):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [part.strip() for part in parts if len(part.strip()) > 20]


def words(text):
    return {word for word in re.findall(r"\w+", text.lower()) if len(word) > 2 and word not in STOP_WORDS}


def usage_today(user_id):
    row = db.one("select count from ai_usage where user_id = %s and day = %s", (user_id, date.today()))
    return row["count"] if row else 0


def spend(user):
    if usage_today(user["id"]) >= DAILY_LIMIT:
        raise HTTPException(429, f"Денний ліміт AI ({DAILY_LIMIT} запитів) вичерпано. Спробуйте завтра")
    db.execute(
        "insert into ai_usage (user_id, day, count) values (%s, %s, 1) "
        "on conflict (user_id, day) do update set count = ai_usage.count + 1", (user["id"], date.today()))


def course_sources(course_id):
    materials = db.select(
        "select m.id, m.title, m.kind, m.content from materials m join topics t on t.id = m.topic_id "
        "where t.course_id = %s and m.ai_on", (course_id,))
    recordings = db.select(
        "select r.material_id as id, r.title, r.segments from recordings r join materials m on m.id = r.material_id "
        "join topics t on t.id = m.topic_id where t.course_id = %s and r.shared", (course_id,))
    for row in recordings:
        row["title"] = "Запис: " + row["title"]
        row["kind"] = "recording"
        row["content"] = " ".join(item["text"] for item in row.pop("segments"))
    return materials + recordings


def find_sources(course_id, question):
    asked = words(question)
    scored = []
    for material in course_sources(course_id):
        score = len(asked & words(material["title"] + " " + material["content"]))
        if score:
            scored.append((score, material))
    scored.sort(key=lambda pair: -pair[0])
    ranked = [material for _, material in scored]
    lectures = [material for material in ranked if material["kind"] in ("lecture", "recording")]
    return (lectures or ranked)[:2]


def best_sentences(text, question, count):
    asked = words(question)
    ranked = sorted(sentences(text), key=lambda s: -len(asked & words(s)))[:count]
    return [s for s in sentences(text) if s in ranked]


def get_settings(course_id):
    row = db.one("select * from ai_settings where course_id = %s", (course_id,))
    return {key: bool(row[key]) for key in ("summaries_on", "ask_on", "flashcards_on")}


def cloze_cards(content):
    cards = []
    for sentence in sentences(content):
        candidates = [w for w in re.findall(r"[^\W\d_]{6,}", sentence) if w.lower() not in STOP_WORDS]
        if not candidates:
            continue
        target = max(candidates, key=len)
        cards.append({"front": sentence.replace(target, "_____", 1), "back": target})
    return cards[:6]


def make_summary(title, content):
    text = call_llm(
        "You summarize university lectures. Reply with 4 to 6 short bullet key points, one per line, "
        "each starting with '- '. Use only the given lecture text. Reply in Ukrainian.",
        title + "\n\n" + content)
    demo = text is None
    if demo:
        text = "\n".join("- " + s for s in sentences(content)[:5]) or "- Текст порожній."
    return text, demo


@router.get("/ai/usage")
def usage(user=Depends(current_user)):
    return {"used": usage_today(user["id"]), "limit": DAILY_LIMIT}


@router.get("/courses/{course_id}/ai-settings")
def read_settings(course_id: int, user=Depends(current_user)):
    get_course(course_id, user)
    return get_settings(course_id)


@router.put("/courses/{course_id}/ai-settings")
def write_settings(course_id: int, body: SettingsIn, user=Depends(current_user)):
    manage_course(course_id, user)
    db.execute("update ai_settings set summaries_on = %s, ask_on = %s, flashcards_on = %s where course_id = %s",
               (body.summaries_on, body.ask_on, body.flashcards_on, course_id))
    return get_settings(course_id)


@router.get("/materials/{material_id}/summary")
def cached_summary(material_id: int, user=Depends(current_user)):
    get_material(material_id, user)
    cached = db.one("select text from ai_summaries where material_id = %s", (material_id,))
    return {"summary": cached["text"] if cached else None}


@router.post("/materials/{material_id}/summary")
def summary(material_id: int, user=Depends(current_user)):
    material, course = get_material(material_id, user)
    if material["kind"] != "lecture":
        raise HTTPException(400, "Конспекти доступні лише для лекцій")
    if not get_settings(course["id"])["summaries_on"]:
        raise HTTPException(403, "Викладач вимкнув AI-конспекти для цього курсу")
    cached = db.one("select text from ai_summaries where material_id = %s", (material_id,))
    if cached:
        return {"summary": cached["text"], "cached": True}
    spend(user)
    text, demo = make_summary(material["title"], material["content"])
    db.execute("insert into ai_summaries (material_id, text) values (%s, %s) on conflict do nothing", (material_id, text))
    return {"summary": text, "cached": False, "demo": demo}


def answer_question(user, course_id, question):
    sources = find_sources(course_id, question)
    if not sources:
        return {"found": False, "answer": NOT_FOUND, "sources": []}
    spend(user)
    graded = any(source["kind"] == "lab" for source in sources)
    context = "\n\n".join(f"[{s['title']}]\n{s['content']}" for s in sources)
    system = ("You are a course assistant. Answer only from the given course materials. If the answer is not "
              f"there, reply exactly: {NOT_FOUND}. Materials of kind lab are graded: never give a complete "
              "solution, give hints and explain the theory. Reply in Ukrainian.")
    text = call_llm(system, f"Materials:\n{context}\n\nQuestion: {question}")
    demo = text is None
    if demo:
        picked = " ".join(best_sentences(sources[0]["content"], question, 2))
        text = ("Це оцінювана робота, тому я не даю готового розв'язку. Підказки: " + picked) if graded else picked
    if not text.strip():
        text = NOT_FOUND
    found = NOT_FOUND not in text
    return {
        "found": found,
        "answer": text,
        "demo": demo,
        "graded": graded,
        "sources": [{"id": s["id"], "title": s["title"]} for s in sources] if found else [],
    }


@router.post("/courses/{course_id}/ask")
def ask(course_id: int, body: QuestionIn, user=Depends(current_user)):
    get_course(course_id, user)
    if not get_settings(course_id)["ask_on"]:
        raise HTTPException(403, "Викладач вимкнув AI-помічника для цього курсу")
    return answer_question(user, course_id, body.question)


@router.post("/materials/{material_id}/flashcards/generate")
def generate_cards(material_id: int, user=Depends(current_user)):
    material, course = get_material(material_id, user)
    if material["kind"] != "lecture":
        raise HTTPException(400, "Картки створюються з лекцій")
    if not get_settings(course["id"])["flashcards_on"]:
        raise HTTPException(403, "Викладач вимкнув AI-картки для цього курсу")
    spend(user)
    cards = None
    text = call_llm(
        "Make 4 to 6 study flashcards from the lecture. Reply with JSON only: a list of objects with keys "
        "front and back. Use only the given lecture text. Write in Ukrainian.", material["title"] + "\n\n" + material["content"])
    if text:
        try:
            cards = [{"front": str(c["front"]), "back": str(c["back"])} for c in json.loads(text[text.index("["):text.rindex("]") + 1])]
        except (ValueError, KeyError, TypeError):
            cards = None
    demo = cards is None
    if demo:
        cards = cloze_cards(material["content"])
    now = datetime.now()
    created = []
    for card in cards:
        card_id = db.insert(
            "insert into flashcards (user_id, material_id, front, back, due, created_at) values (%s, %s, %s, %s, %s, %s)",
            (user["id"], material_id, card["front"], card["back"], now, now))
        created.append(db.one("select * from flashcards where id = %s", (card_id,)))
    return {"cards": created, "demo": demo}
