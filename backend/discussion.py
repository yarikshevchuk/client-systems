from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import db
from access import can_manage, get_course, member_ids
from auth import current_user
from live import hub
from notify import notify

router = APIRouter(prefix="/api")

MESSAGE_SQL = (
    "select m.id, m.course_id, m.channel, m.user_id, m.parent_id, m.text, m.accepted, m.resolved, m.created_at, "
    "u.name as author, u.role from messages m join users u on u.id = m.user_id")


class MessageIn(BaseModel):
    channel: Literal["general", "qa"] = "qa"
    text: str = Field(min_length=1, max_length=3000)
    parent_id: Optional[int] = None


@router.get("/courses/{course_id}/messages")
def list_messages(course_id: int, channel: str = Query(default="qa"), user=Depends(current_user)):
    get_course(course_id, user)
    if channel not in ("general", "qa"):
        raise HTTPException(422, "Невідомий канал")
    rows = db.select(MESSAGE_SQL + " where m.course_id = %s and m.channel = %s order by m.id desc limit 300",
                     (course_id, channel))
    return list(reversed(rows))


@router.post("/courses/{course_id}/messages")
async def post_message(course_id: int, body: MessageIn, user=Depends(current_user)):
    course = get_course(course_id, user)
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Повідомлення порожнє")
    parent = None
    if body.parent_id:
        parent = db.one("select * from messages where id = %s and course_id = %s", (body.parent_id, course_id))
        if not parent or parent["parent_id"]:
            raise HTTPException(404, "Питання не знайдено")
        body.channel = parent["channel"]
    message_id = db.insert(
        "insert into messages (course_id, channel, user_id, parent_id, text, created_at) values (%s, %s, %s, %s, %s, %s)",
        (course_id, body.channel, user["id"], body.parent_id, text, datetime.now()))
    message = db.one(MESSAGE_SQL + " where m.id = %s", (message_id,))
    members = member_ids(course)
    await hub.send(members, {"type": "message", "message": message})
    link = f"/courses/{course_id}?tab=discussion"
    if parent and parent["user_id"] != user["id"]:
        await notify([parent["user_id"]], "reply", f"{user['name']}: нова відповідь на ваше питання в курсі «{course['title']}»", link)
    elif not parent and body.channel == "qa" and user["role"] == "student":
        await notify([course["teacher_id"]], "question", f"Нове питання в курсі «{course['title']}»", link)
    return message


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
