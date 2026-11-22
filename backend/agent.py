import json
import random
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import ai
import db
from access import get_course, get_material
from auth import current_user
from courses import course_progress

router = APIRouter(prefix="/api")


class AgentIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    material_id: Optional[int] = None


def has(text, *parts):
    return any(part in text for part in parts)


def deadlines_answer(user, course_id):
    rows = db.select(
        "select m.id, m.title, m.deadline, s.id as submission_id from materials m "
        "join topics t on t.id = m.topic_id left join submissions s on s.material_id = m.id and s.student_id = %s "
        "where t.course_id = %s and m.kind = 'lab' and m.deadline is not null order by m.deadline",
        (user["id"], course_id))
    if not rows:
        return "У цьому курсі ще немає лабораторних із дедлайнами.", []
    pending = [row for row in rows if not row["submission_id"]] if user["role"] == "student" else rows
    if not pending:
        return "Усі лабораторні цього курсу вже здано.", []
    now = datetime.now()
    lines = [f"• {row['title']}: до {row['deadline']:%d.%m о %H:%M}" + (" (прострочено)" if row["deadline"] < now else "")
             for row in pending]
    head = "Що ще треба здати в цьому курсі:" if user["role"] == "student" else "Дедлайни курсу:"
    return head + "\n" + "\n".join(lines), [{"id": row["id"], "title": row["title"]} for row in pending]


def grades_answer(user, course_id):
    if user["role"] != "student":
        return "Оцінки студентів дивіться в журналі оцінок курсу.", []
    progress = course_progress(user["id"], course_id)
    if not progress["total_max"]:
        return "У цьому курсі ще немає лабораторних з оцінюванням.", []
    lines = [f"• {lab['title']}: {lab['grade']} / {lab['max_points']}" for lab in progress["labs"] if lab["grade"] is not None]
    text = (f"Зараз у вас {progress['earned']} балів із {progress['total_max']} можливих. "
            f"За оціненими роботами це {progress['percent_graded']}%. " if progress["graded_max"] else
            f"Оцінених робіт ще немає. Максимум за курс: {progress['total_max']} балів. ")
    text += f"Ще не оцінено: {progress['total_max'] - progress['graded_max']} балів."
    return text + ("\n" + "\n".join(lines) if lines else ""), []


def build_quiz(content, count=3):
    rng = random.Random(len(content))
    pool = sorted({word for word in re.findall(r"[^\W\d_]{6,}", content) if word.lower() not in ai.STOP_WORDS})
    quiz = []
    for sentence in ai.sentences(content):
        candidates = [word for word in re.findall(r"[^\W\d_]{6,}", sentence) if word.lower() not in ai.STOP_WORDS]
        if not candidates:
            continue
        target = max(candidates, key=len)
        distractors = [word for word in pool if word.lower() != target.lower()]
        rng.shuffle(distractors)
        options = [target] + distractors[:3]
        rng.shuffle(options)
        quiz.append({"question": sentence.replace(target, "_____", 1), "options": options, "answer": options.index(target)})
        if len(quiz) == count:
            break
    return quiz


def pick_target(course_id, user, material, message):
    if material:
        return material
    for source in ai.find_sources(course_id, message):
        if source["kind"] in ("lecture", "lab"):
            return source
    return db.one(
        "select m.id, m.title, m.kind, m.content from materials m join topics t on t.id = m.topic_id "
        "where t.course_id = %s and m.kind = 'lecture' order by t.position, m.id limit 1", (course_id,))


def run_intent(user, course_id, text, message, material):
    settings = ai.get_settings(course_id)
    answer, sources, extra = "", [], {}
    if has(text, "дедлайн", "здати", "здавати", "термін", "deadline", "due"):
        answer, sources = deadlines_answer(user, course_id)
    elif has(text, "оцінк", "балів", "бали", "прогрес", "успішн", "grade", "points", "progress"):
        answer, sources = grades_answer(user, course_id)
    elif has(text, "тест", "перевір", "запитай мене", "вікторин", "quiz", "test me"):
        if not settings["ask_on"]:
            raise HTTPException(403, "Викладач вимкнув AI-помічника для цього курсу")
        target = pick_target(course_id, user, material, message)
        quiz = build_quiz(target["content"]) if target else []
        if not quiz:
            return "З цього матеріалу не вдалося скласти тест. Відкрийте лекцію й спробуйте ще раз.", [], {}
        ai.spend(user)
        answer = f"Короткий тест за матеріалом «{target['title']}». Оберіть правильне слово."
        sources, extra = [{"id": target["id"], "title": target["title"]}], {"quiz": quiz}
    elif has(text, "картк", "flashcard", "cards"):
        target = pick_target(course_id, user, material, message)
        if not target or target["kind"] != "lecture":
            return "Відкрийте лекцію або назвіть її, і я зроблю картки.", [], {}
        result = ai.generate_cards(target["id"], user)
        answer = f"Додав карток у вашу колоду: {len(result['cards'])}."
        sources, extra = [{"id": target["id"], "title": target["title"]}], {"link": "/flashcards"}
    elif has(text, "конспект", "підсумуй", "підсумок", "коротко", "summary", "summarize"):
        target = pick_target(course_id, user, material, message)
        if not target or target["kind"] != "lecture":
            return "Відкрийте лекцію або назвіть її, і я складу конспект.", [], {}
        result = ai.summary(target["id"], user)
        answer = f"Ключові думки «{target['title']}»:\n" + result["summary"]
        sources = [{"id": target["id"], "title": target["title"]}]
    else:
        if not settings["ask_on"]:
            raise HTTPException(403, "Викладач вимкнув AI-помічника для цього курсу")
        result = ai.answer_question(user, course_id, message)
        answer, sources = result["answer"], result["sources"]
        extra = {"graded": result.get("graded", False)}
    return answer, sources, extra


def save(user, course_id, role, text, sources=(), extra=None):
    message_id = db.insert(
        "insert into ai_messages (user_id, course_id, role, text, sources, extra, created_at) "
        "values (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)",
        (user["id"], course_id, role, text, json.dumps(list(sources)), json.dumps(extra or {}), datetime.now()))
    return db.one("select id, role, text, sources, extra, created_at from ai_messages where id = %s", (message_id,))


@router.get("/courses/{course_id}/agent")
def history(course_id: int, user=Depends(current_user)):
    get_course(course_id, user)
    rows = db.select(
        "select id, role, text, sources, extra, created_at from ai_messages where user_id = %s and course_id = %s "
        "order by id desc limit 60", (user["id"], course_id))
    return list(reversed(rows))


@router.delete("/courses/{course_id}/agent")
def clear(course_id: int, user=Depends(current_user)):
    get_course(course_id, user)
    db.execute("delete from ai_messages where user_id = %s and course_id = %s", (user["id"], course_id))
    return {"ok": True}


@router.post("/courses/{course_id}/agent")
def agent(course_id: int, body: AgentIn, user=Depends(current_user)):
    get_course(course_id, user)
    material = None
    if body.material_id:
        material, _ = get_material(body.material_id, user)
        if material["course_id"] != course_id:
            raise HTTPException(400, "Матеріал з іншого курсу")
    save(user, course_id, "user", body.message.strip())
    try:
        answer, sources, extra = run_intent(user, course_id, body.message.lower(), body.message, material)
    except HTTPException as error:
        answer, sources, extra = str(error.detail), [], {"error": True}
    return save(user, course_id, "assistant", answer, sources, extra)
