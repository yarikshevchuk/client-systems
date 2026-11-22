import csv
import io
import secrets
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

import db
from auth import admin_only, hash_password

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


@router.post("/import")
async def import_registry(file: UploadFile = File(...), user=Depends(admin_only)):
    text = (await file.read()).decode("utf-8-sig", errors="replace")
    dialect = csv.Sniffer().sniff(text.splitlines()[0] if text.strip() else ",", delimiters=",;\t")
    rows = list(csv.reader(io.StringIO(text), dialect))
    if rows and rows[0] and not rows[0][0].strip().isdigit():
        rows = rows[1:]
    created, skipped = [], []
    for row in rows:
        cells = [cell.strip() for cell in row]
        if len(cells) < 3 or not cells[0] or not cells[1]:
            if any(cells):
                skipped.append({"row": ";".join(cells), "reason": "Потрібно: номер квитка, ПІБ, група"})
            continue
        ticket, name, grp = cells[0], cells[1], cells[2]
        role = cells[3].lower() if len(cells) > 3 and cells[3].lower() in ("student", "teacher") else "student"
        email = f"{ticket.lower()}@vns.lpnu.demo"
        if db.one("select id from users where ticket = %s or email = %s", (ticket, email)):
            skipped.append({"row": ";".join(cells), "reason": "Уже є в системі"})
            continue
        password = secrets.token_urlsafe(6)
        db.insert(
            "insert into users (name, email, password_hash, role, grp, ticket, created_at) values (%s, %s, %s, %s, %s, %s, %s)",
            (name, email, hash_password(password), role, grp if role == "student" else "", ticket, datetime.now()))
        created.append({"ticket": ticket, "name": name, "group": grp, "role": role, "email": email, "password": password})
    return {"created": created, "skipped": skipped}
