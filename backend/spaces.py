from datetime import datetime

from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import db
from auth import current_user
from live import hub
from submissions import save_upload

router = APIRouter(prefix="/api")


class SpaceIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    topic: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=1000)


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    assignee_id: Optional[int] = None


class TaskUpdate(BaseModel):
    status: Optional[Literal["todo", "doing", "done"]] = None
    assignee_id: Optional[int] = None


class SpaceMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)


def get_space(space_id):
    space = db.one(
        "select s.*, u.name as owner, (select count(*) from space_members m where m.space_id = s.id) as members "
        "from spaces s join users u on u.id = s.owner_id where s.id = %s", (space_id,))
    if not space:
        raise HTTPException(404, "Простір не знайдено")
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
    tasks, files = [], []
    if joined:
        tasks = db.select(
            "select t.*, u.name as assignee from space_tasks t left join users u on u.id = t.assignee_id "
            "where t.space_id = %s order by t.id", (space_id,))
        files = db.select(
            "select f.id, f.filename, f.size, f.created_at, f.user_id, u.name as author from space_files f "
            "join users u on u.id = f.user_id where f.space_id = %s order by f.id desc", (space_id,))
    for member in members:
        member["done"] = db.one("select count(*) as n from space_tasks where space_id = %s and assignee_id = %s and status = 'done'",
                                (space_id, member["id"]))["n"]
        member["open"] = db.one("select count(*) as n from space_tasks where space_id = %s and assignee_id = %s and status <> 'done'",
                                (space_id, member["id"]))["n"]
        member["posts"] = db.one("select count(*) as n from space_messages where space_id = %s and user_id = %s",
                                 (space_id, member["id"]))["n"]
        member["files"] = db.one("select count(*) as n from space_files where space_id = %s and user_id = %s",
                                 (space_id, member["id"]))["n"]
    return {"space": space, "joined": joined, "members": members, "messages": messages, "tasks": tasks, "files": files}


def require_member(space_id, user):
    get_space(space_id)
    if not is_member(space_id, user["id"]):
        raise HTTPException(403, "Приєднайтеся до простору")


async def space_changed(space_id):
    members = [row["user_id"] for row in db.select("select user_id from space_members where space_id = %s", (space_id,))]
    await hub.send(members, {"type": "space_changed", "space_id": space_id})


def check_assignee(space_id, assignee_id):
    if assignee_id is not None and not is_member(space_id, assignee_id):
        raise HTTPException(422, "Виконавець має бути учасником простору")


@router.post("/spaces/{space_id}/tasks")
async def add_task(space_id: int, body: TaskIn, user=Depends(current_user)):
    require_member(space_id, user)
    check_assignee(space_id, body.assignee_id)
    task_id = db.insert(
        "insert into space_tasks (space_id, title, assignee_id, created_by, created_at) values (%s, %s, %s, %s, %s)",
        (space_id, body.title.strip(), body.assignee_id, user["id"], datetime.now()))
    await space_changed(space_id)
    return db.one("select * from space_tasks where id = %s", (task_id,))


@router.put("/space-tasks/{task_id}")
async def update_task(task_id: int, body: TaskUpdate, user=Depends(current_user)):
    task = db.one("select * from space_tasks where id = %s", (task_id,))
    if not task:
        raise HTTPException(404, "Задачу не знайдено")
    require_member(task["space_id"], user)
    if body.status:
        db.execute("update space_tasks set status = %s, done_at = %s where id = %s",
                   (body.status, datetime.now() if body.status == "done" else None, task_id))
    if "assignee_id" in body.model_fields_set:
        check_assignee(task["space_id"], body.assignee_id)
        db.execute("update space_tasks set assignee_id = %s where id = %s", (body.assignee_id, task_id))
    await space_changed(task["space_id"])
    return db.one("select * from space_tasks where id = %s", (task_id,))


@router.delete("/space-tasks/{task_id}")
async def delete_task(task_id: int, user=Depends(current_user)):
    task = db.one("select * from space_tasks where id = %s", (task_id,))
    if not task:
        raise HTTPException(404, "Задачу не знайдено")
    require_member(task["space_id"], user)
    db.execute("delete from space_tasks where id = %s", (task_id,))
    await space_changed(task["space_id"])
    return {"ok": True}


@router.post("/spaces/{space_id}/files")
async def add_file(space_id: int, file: UploadFile = File(...), user=Depends(current_user)):
    require_member(space_id, user)
    stored, filename, size = await save_upload(file)
    file_id = db.insert(
        "insert into space_files (space_id, user_id, filename, stored_name, size, created_at) values (%s, %s, %s, %s, %s, %s)",
        (space_id, user["id"], filename, stored, size, datetime.now()))
    await space_changed(space_id)
    return db.one("select id, filename, size, created_at from space_files where id = %s", (file_id,))


@router.get("/space-files/{file_id}/file")
def get_file(file_id: int, user=Depends(current_user)):
    row = db.one("select * from space_files where id = %s", (file_id,))
    if not row:
        raise HTTPException(404, "Файл не знайдено")
    require_member(row["space_id"], user)
    return FileResponse(db.UPLOADS / row["stored_name"], filename=row["filename"])


@router.delete("/space-files/{file_id}")
async def delete_file(file_id: int, user=Depends(current_user)):
    row = db.one("select * from space_files where id = %s", (file_id,))
    if not row:
        raise HTTPException(404, "Файл не знайдено")
    require_member(row["space_id"], user)
    db.execute("delete from space_files where id = %s", (file_id,))
    await space_changed(row["space_id"])
    return {"ok": True}


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
        raise HTTPException(400, "Власник не може залишити простір. Видаліть його")
    db.execute("delete from space_members where space_id = %s and user_id = %s", (space_id, user["id"]))
    return {"joined": False}


@router.delete("/spaces/{space_id}")
def delete_space(space_id: int, user=Depends(current_user)):
    space = get_space(space_id)
    if space["owner_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "Видалити простір може лише власник")
    db.execute("delete from spaces where id = %s", (space_id,))
    return {"ok": True}


@router.post("/spaces/{space_id}/messages")
async def post_space_message(space_id: int, body: SpaceMessageIn, user=Depends(current_user)):
    get_space(space_id)
    if not is_member(space_id, user["id"]):
        raise HTTPException(403, "Приєднайтеся до простору, щоб писати в ньому")
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Повідомлення порожнє")
    message_id = db.insert(
        "insert into space_messages (space_id, user_id, text, created_at) values (%s, %s, %s, %s)",
        (space_id, user["id"], text, datetime.now()))
    message = db.one(
        "select m.id, m.space_id, m.user_id, m.text, m.created_at, u.name as author from space_messages m "
        "join users u on u.id = m.user_id where m.id = %s", (message_id,))
    members = [row["user_id"] for row in db.select("select user_id from space_members where space_id = %s", (space_id,))]
    await hub.send(members, {"type": "space_message", "message": message})
    return message
