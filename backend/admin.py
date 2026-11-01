from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import db
from auth import admin_only

router = APIRouter(prefix="/api/admin")


class RoleIn(BaseModel):
    role: Literal["student", "teacher", "admin"]


@router.get("/stats")
def stats(user=Depends(admin_only)):
    return {
        "users": db.one("select count(*) as n from users")["n"],
        "students": db.one("select count(*) as n from users where role = 'student'")["n"],
        "teachers": db.one("select count(*) as n from users where role = 'teacher'")["n"],
        "courses": db.one("select count(*) as n from courses")["n"],
        "submissions": db.one("select count(*) as n from submissions")["n"],
        "messages": db.one("select count(*) as n from messages")["n"],
    }


@router.get("/users")
def users(user=Depends(admin_only)):
    return db.select("select id, name, email, role, grp, last_seen, created_at from users order by role, name")


@router.put("/users/{user_id}")
def set_role(user_id: int, body: RoleIn, user=Depends(admin_only)):
    if user_id == user["id"]:
        raise HTTPException(400, "Ви не можете змінити власну роль")
    if not db.one("select id from users where id = %s", (user_id,)):
        raise HTTPException(404, "Користувача не знайдено")
    db.execute("update users set role = %s where id = %s", (body.role, user_id))
    return db.one("select id, name, email, role, grp from users where id = %s", (user_id,))
