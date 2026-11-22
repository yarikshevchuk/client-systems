from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import db
from access import can_manage, get_course, member_ids
from auth import current_user
from live import hub
from notify import notify
from submissions import save_upload

router = APIRouter(prefix="/api")

MESSAGE_SQL = (
    "select m.id, m.course_id, m.channel, m.user_id, m.parent_id, m.text, m.accepted, m.resolved, m.created_at, m.file_name, "
    "u.name as author, u.role from messages m join users u on u.id = m.user_id")


class MessageIn(BaseModel):
    channel: str = "qa"
    text: str = Field(min_length=1, max_length=3000)
    parent_id: Optional[int] = None


def channels(course_id):
    result = [{"id": "qa", "title": "питання", "hint": "Q&A з гілками відповідей"},
              {"id": "general", "title": "загальний", "hint": "Чат усього курсу"}]
    topics = db.select("select id, title from topics where course_id = %s order by position, id", (course_id,))
    for number, topic in enumerate(topics, 1):
        result.append({"id": f"topic-{topic['id']}", "title": f"модуль-{number}", "hint": topic["title"]})
    labs = db.select(
        "select m.id, m.title from materials m join topics t on t.id = m.topic_id "
        "where t.course_id = %s and m.kind = 'lab' order by t.position, m.id", (course_id,))
    for number, lab in enumerate(labs, 1):
        result.append({"id": f"lab-{lab['id']}", "title": f"лаба-{number}", "hint": lab["title"]})
    return result


def check_channel(course_id, channel):
    if channel not in {item["id"] for item in channels(course_id)}:
        raise HTTPException(422, "Невідомий канал")


@router.get("/courses/{course_id}/channels")
def list_channels(course_id: int, user=Depends(current_user)):
    get_course(course_id, user)
    return channels(course_id)


@router.get("/courses/{course_id}/messages")
def list_messages(course_id: int, channel: str = Query(default="qa"), user=Depends(current_user)):
    get_course(course_id, user)
    check_channel(course_id, channel)
    rows = db.select(MESSAGE_SQL + " where m.course_id = %s and m.channel = %s order by m.id desc limit 300",
                     (course_id, channel))
    return list(reversed(rows))


async def create_message(course, user, channel, text, parent_id, upload=None):
    text = text.strip()
    if not text and not upload:
        raise HTTPException(422, "Повідомлення порожнє")
    parent = None
    if parent_id:
        parent = db.one("select * from messages where id = %s and course_id = %s", (parent_id, course["id"]))
        if not parent or parent["parent_id"]:
            raise HTTPException(404, "Питання не знайдено")
        channel = parent["channel"]
    check_channel(course["id"], channel)
    stored, filename = (None, None)
    if upload:
        stored, filename, _ = await save_upload(upload)
    message_id = db.insert(
        "insert into messages (course_id, channel, user_id, parent_id, text, file_name, stored_name, created_at) "
        "values (%s, %s, %s, %s, %s, %s, %s, %s)",
        (course["id"], channel, user["id"], parent_id, text, filename, stored, datetime.now()))
    message = db.one(MESSAGE_SQL + " where m.id = %s", (message_id,))
    await hub.send(member_ids(course), {"type": "message", "message": message})
    link = f"/courses/{course['id']}?tab=discussion"
    if parent and parent["user_id"] != user["id"]:
        await notify([parent["user_id"]], "reply", f"{user['name']}: нова відповідь на ваше питання в курсі «{course['title']}»", link)
    elif not parent and (channel == "qa" or channel.startswith("lab-")) and user["role"] == "student":
        await notify([course["teacher_id"]], "question", f"Нове питання в курсі «{course['title']}»", link)
    return message


@router.post("/courses/{course_id}/messages")
async def post_message(course_id: int, body: MessageIn, user=Depends(current_user)):
    course = get_course(course_id, user)
    return await create_message(course, user, body.channel, body.text, body.parent_id)


@router.post("/courses/{course_id}/messages/file")
async def post_file_message(course_id: int, channel: str = Form(default="general"), text: str = Form(default=""),
                            parent_id: Optional[int] = Form(default=None), file: UploadFile = File(...),
                            user=Depends(current_user)):
    course = get_course(course_id, user)
    return await create_message(course, user, channel, text, parent_id, file)


@router.get("/messages/{message_id}/file")
def message_file(message_id: int, user=Depends(current_user)):
    message = db.one("select * from messages where id = %s", (message_id,))
    if not message or not message["stored_name"]:
        raise HTTPException(404, "Файл не знайдено")
    get_course(message["course_id"], user)
    path = db.UPLOADS / message["stored_name"]
    if not path.exists():
        raise HTTPException(404, "Файл не знайдено")
    return FileResponse(path, filename=message["file_name"])


@router.post("/messages/{message_id}/accept")
async def accept_answer(message_id: int, user=Depends(current_user)):
    answer = db.one("select * from messages where id = %s", (message_id,))
    if not answer or not answer["parent_id"]:
        raise HTTPException(404, "Відповідь не знайдено")
    question = db.one("select * from messages where id = %s", (answer["parent_id"],))
    course = get_course(answer["course_id"], user)
    if question["user_id"] != user["id"] and not can_manage(course, user):
        raise HTTPException(403, "Прийняти відповідь може лише автор питання або викладач")
    accepted = not answer["accepted"]
    db.execute("update messages set accepted = false where parent_id = %s", (question["id"],))
    db.execute("update messages set accepted = %s where id = %s", (accepted, message_id))
    db.execute("update messages set resolved = %s where id = %s", (accepted, question["id"]))
    if accepted and answer["user_id"] != user["id"]:
        await notify([answer["user_id"]], "accepted", f"Вашу відповідь прийнято в курсі «{course['title']}»",
                     f"/courses/{course['id']}?tab=discussion")
    await hub.send(member_ids(course), {"type": "message_changed", "course_id": course["id"]})
    return {"accepted": accepted}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: int, user=Depends(current_user)):
    message = db.one("select * from messages where id = %s", (message_id,))
    if not message:
        raise HTTPException(404, "Повідомлення не знайдено")
    course = get_course(message["course_id"], user)
    if message["user_id"] != user["id"] and not can_manage(course, user):
        raise HTTPException(403, "Можна видаляти лише власні повідомлення")
    db.execute("delete from messages where id = %s", (message_id,))
    await hub.send(member_ids(course), {"type": "message_changed", "course_id": course["id"]})
    return {"ok": True}
