from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import db
from auth import current_user
from live import hub

router = APIRouter(prefix="/api")


class SpaceIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    topic: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=1000)


class SpaceMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)


def get_space(space_id):
    space = db.one(
        "select s.*, u.name as owner, (select count(*) from space_members m where m.space_id = s.id) as members "
        "from spaces s join users u on u.id = s.owner_id where s.id = %s", (space_id,))
    if not space:
        raise HTTPException(404, "Space not found")
    return space


def is_member(space_id, user_id):
    return db.one("select 1 as ok from space_members where space_id = %s and user_id = %s", (space_id, user_id)) is not None


@router.get("/spaces")
def list_spaces(q: str = Query(default=""), user=Depends(current_user)):
    pattern = f"%{q.strip()}%"
    rows = db.select(
        "select s.*, u.name as owner, (select count(*) from space_members m where m.space_id = s.id) as members, "
        "exists (select 1 from space_members m where m.space_id = s.id and m.user_id = %s) as joined "
        "from spaces s join users u on u.id = s.owner_id "
        "where s.title ilike %s or s.topic ilike %s or s.description ilike %s order by s.created_at desc",
        (user["id"], pattern, pattern, pattern))
    return rows


@router.post("/spaces")
def create_space(body: SpaceIn, user=Depends(current_user)):
    now = datetime.now()
    space_id = db.insert(
        "insert into spaces (title, topic, description, owner_id, created_at) values (%s, %s, %s, %s, %s)",
        (body.title.strip(), body.topic.strip(), body.description.strip(), user["id"], now))
    db.execute("insert into space_members (space_id, user_id, joined_at) values (%s, %s, %s)", (space_id, user["id"], now))
    return get_space(space_id)


@router.get("/spaces/{space_id}")
def space_detail(space_id: int, user=Depends(current_user)):
    space = get_space(space_id)
    joined = is_member(space_id, user["id"])
    members = db.select(
        "select u.id, u.name, u.role from space_members m join users u on u.id = m.user_id "
        "where m.space_id = %s order by m.joined_at", (space_id,))
    messages = []
    if joined:
        messages = list(reversed(db.select(
            "select m.id, m.space_id, m.user_id, m.text, m.created_at, u.name as author from space_messages m "
            "join users u on u.id = m.user_id where m.space_id = %s order by m.id desc limit 200", (space_id,))))
    return {"space": space, "joined": joined, "members": members, "messages": messages}


@router.post("/spaces/{space_id}/join")
def join_space(space_id: int, user=Depends(current_user)):
    get_space(space_id)
    db.execute("insert into space_members (space_id, user_id, joined_at) values (%s, %s, %s) on conflict do nothing",
               (space_id, user["id"], datetime.now()))
    return {"joined": True}


@router.post("/spaces/{space_id}/leave")
def leave_space(space_id: int, user=Depends(current_user)):
    space = get_space(space_id)
    if space["owner_id"] == user["id"]:
        raise HTTPException(400, "The owner cannot leave the space. Delete it instead")
    db.execute("delete from space_members where space_id = %s and user_id = %s", (space_id, user["id"]))
    return {"joined": False}


@router.delete("/spaces/{space_id}")
def delete_space(space_id: int, user=Depends(current_user)):
    space = get_space(space_id)
    if space["owner_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "Only the owner can delete this space")
    db.execute("delete from spaces where id = %s", (space_id,))
    return {"ok": True}


@router.post("/spaces/{space_id}/messages")
async def post_space_message(space_id: int, body: SpaceMessageIn, user=Depends(current_user)):
    get_space(space_id)
    if not is_member(space_id, user["id"]):
        raise HTTPException(403, "Join the space to write in it")
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Message is empty")
    message_id = db.insert(
        "insert into space_messages (space_id, user_id, text, created_at) values (%s, %s, %s, %s)",
        (space_id, user["id"], text, datetime.now()))
    message = db.one(
        "select m.id, m.space_id, m.user_id, m.text, m.created_at, u.name as author from space_messages m "
        "join users u on u.id = m.user_id where m.id = %s", (message_id,))
    members = [row["user_id"] for row in db.select("select user_id from space_members where space_id = %s", (space_id,))]
    await hub.send(members, {"type": "space_message", "message": message})
    return message
