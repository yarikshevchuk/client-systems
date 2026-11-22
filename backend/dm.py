from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import db
from access import can_message, contacts
from auth import current_user
from live import hub

router = APIRouter(prefix="/api")


class DirectIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)


@router.get("/contacts")
def list_contacts(user=Depends(current_user)):
    return contacts(user)


@router.get("/dm")
def conversations(user=Depends(current_user)):
    rows = db.select(
        "select distinct on (other_id) other_id, id, sender_id, text, created_at from ("
        "select case when sender_id = %s then recipient_id else sender_id end as other_id, id, sender_id, text, created_at "
        "from direct_messages where sender_id = %s or recipient_id = %s) t order by other_id, created_at desc, id desc",
        (user["id"], user["id"], user["id"]))
    result = []
    for row in rows:
        other = db.one("select id, name, role from users where id = %s", (row["other_id"],))
        unread = db.one(
            "select count(*) as n from direct_messages where sender_id = %s and recipient_id = %s and read_at is null",
            (row["other_id"], user["id"]))["n"]
        result.append({"user": other, "last": {"text": row["text"], "created_at": row["created_at"],
                                                "sender_id": row["sender_id"]}, "unread": unread})
    result.sort(key=lambda item: item["last"]["created_at"], reverse=True)
    return result


@router.get("/dm/{other_id}")
def thread(other_id: int, user=Depends(current_user)):
    other = db.one("select id, name, role from users where id = %s", (other_id,))
    if not other:
        raise HTTPException(404, "Користувача не знайдено")
    db.execute("update direct_messages set read_at = %s where sender_id = %s and recipient_id = %s and read_at is null",
               (datetime.now(), other_id, user["id"]))
    messages = db.select(
        "select id, sender_id, recipient_id, text, created_at from direct_messages "
        "where (sender_id = %s and recipient_id = %s) or (sender_id = %s and recipient_id = %s) order by id",
        (user["id"], other_id, other_id, user["id"]))
    return {"user": other, "messages": messages}


@router.post("/dm/{other_id}")
async def send(other_id: int, body: DirectIn, user=Depends(current_user)):
    existing = db.one(
        "select 1 as ok from direct_messages where (sender_id = %s and recipient_id = %s) or "
        "(sender_id = %s and recipient_id = %s) limit 1", (user["id"], other_id, other_id, user["id"]))
    if not existing and not can_message(user, other_id):
        raise HTTPException(403, "Писати можна лише людям з ваших курсів")
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Повідомлення порожнє")
    message_id = db.insert(
        "insert into direct_messages (sender_id, recipient_id, text, created_at) values (%s, %s, %s, %s)",
        (user["id"], other_id, text, datetime.now()))
    message = db.one("select id, sender_id, recipient_id, text, created_at from direct_messages where id = %s", (message_id,))
    await hub.send([other_id], {"type": "dm", "message": message, "from": {"id": user["id"], "name": user["name"]}})
    return message
