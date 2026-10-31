import json
import os
import re
import urllib.request

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import courses
import db
from auth import current_user, teacher_only

router = APIRouter(prefix="/api")

NOT_FOUND = "Not found in the course materials"

STOP_WORDS = {
    "the", "and", "for", "what", "how", "why", "when", "does", "this", "that", "with", "from", "are", "was",
    "about", "can", "you", "explain", "tell", "give", "show", "mean", "means",
    "що", "таке", "як", "чому", "коли", "це", "для", "про", "або", "чи", "які", "який", "яка", "мені",
}


class SettingsIn(BaseModel):
    summaries_on: bool
    ask_on: bool


class QuestionIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


def call_llm(system, user):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    body = json.dumps({
        "model": os.environ.get("AI_MODEL", "claude-sonnet-5-5"),
        "max_tokens": 600,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode()
    request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)["content"][0]["text"].strip()
    except Exception:
        return None


def sentences(text):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [part.strip() for part in parts if len(part.strip()) > 20]


def words(text):
    return {word for word in re.findall(r"\w+", text.lower()) if len(word) > 2 and word not in STOP_WORDS}


def find_sources(course_id, question):
    asked = words(question)
    scored = []
    materials = db.select(
        "select m.id, m.title, m.kind, m.content from materials m join topics t on t.id = m.topic_id "
        "where t.course_id = ?", (course_id,))
    for material in materials:
        score = len(asked & words(material["title"] + " " + material["content"]))
        if score:
            scored.append((score, material))
    scored.sort(key=lambda pair: -pair[0])
    return [material for _, material in scored[:2]]


def best_sentences(text, question, count):
    asked = words(question)
    ranked = sorted(sentences(text), key=lambda s: -len(asked & words(s)))[:count]
    return [s for s in sentences(text) if s in ranked]


def get_settings(course_id):
    row = db.one("select * from ai_settings where course_id = ?", (course_id,))
    return {"summaries_on": bool(row["summaries_on"]), "ask_on": bool(row["ask_on"])}


@router.get("/courses/{course_id}/ai-settings")
def read_settings(course_id: int, user=Depends(current_user)):
    courses.get_course(course_id, user)
    return get_settings(course_id)


@router.put("/courses/{course_id}/ai-settings")
def write_settings(course_id: int, body: SettingsIn, user=Depends(teacher_only)):
    courses.get_course(course_id, user)
    db.execute("update ai_settings set summaries_on = ?, ask_on = ? where course_id = ?",
               (int(body.summaries_on), int(body.ask_on), course_id))
    return get_settings(course_id)


@router.post("/materials/{material_id}/summary")
def summary(material_id: int, user=Depends(current_user)):
    material = courses.get_material(material_id, user)
    if material["kind"] != "lecture":
        raise HTTPException(400, "Summaries are available for lectures only")
    if not get_settings(material["course_id"])["summaries_on"]:
        raise HTTPException(403, "AI summaries are turned off for this course by the lecturer")
    cached = db.one("select text from ai_summaries where material_id = ?", (material_id,))
    if cached:
        return {"summary": cached["text"], "cached": True}
    text = call_llm(
        "You summarize university lectures. Reply with 4 to 6 short bullet key points, one per line, "
        "each starting with '- '. Use only the given lecture text.",
        material["title"] + "\n\n" + material["content"])
    demo = text is None
    if demo:
        text = "\n".join("- " + s for s in sentences(material["content"])[:5]) or "- The lecture text is empty."
    db.execute("insert into ai_summaries (material_id, text) values (?, ?)", (material_id, text))
    return {"summary": text, "cached": False, "demo": demo}


@router.post("/courses/{course_id}/ask")
def ask(course_id: int, body: QuestionIn, user=Depends(current_user)):
    courses.get_course(course_id, user)
    if not get_settings(course_id)["ask_on"]:
        raise HTTPException(403, "The AI assistant is turned off for this course by the lecturer")
    sources = find_sources(course_id, body.question)
    if not sources:
        return {"found": False, "answer": NOT_FOUND, "sources": []}
    graded = any(source["kind"] == "lab" for source in sources)
    context = "\n\n".join(f"[{s['title']}]\n{s['content']}" for s in sources)
    system = ("You are a course assistant. Answer only from the given course materials. If the answer is not "
              f"there, reply exactly: {NOT_FOUND}. Materials of kind lab are graded: never give a complete "
              "solution, give hints and explain the theory.")
    text = call_llm(system, f"Materials:\n{context}\n\nQuestion: {body.question}")
    demo = text is None
    if demo:
        if graded:
            hints = " ".join(best_sentences(sources[0]["content"], body.question, 2))
            text = ("This task is graded, so I will not give a ready solution. Hints: " + hints)
        else:
            text = " ".join(best_sentences(sources[0]["content"], body.question, 2))
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
