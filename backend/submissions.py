import re
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import db
from access import can_manage, get_course, get_material, manage_course
from auth import current_user
from notify import notify

router = APIRouter(prefix="/api")

MAX_UPLOAD = 20 * 1024 * 1024


def safe_name(name):
    return re.sub(r"[^\w.\- ]", "_", Path(name or "file").name) or "file"


async def save_upload(file):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Файл більший за 20 МБ")
    stored = uuid.uuid4().hex
    (db.UPLOADS / stored).write_bytes(data)
    return stored, safe_name(file.filename), len(data)


class GradeIn(BaseModel):
    grade: int = Field(ge=0)
    feedback: str = Field(default="", max_length=2000)


@router.post("/materials/{material_id}/submit")
async def submit(material_id: int, comment: str = Form(default=""), file: UploadFile = File(...), user=Depends(current_user)):
    if user["role"] != "student":
        raise HTTPException(403, "Подавати роботи можуть лише студенти")
    material, course = get_material(material_id, user)
    if material["kind"] != "lab":
        raise HTTPException(400, "Роботи приймаються лише для лабораторних")
    existing = db.one("select * from submissions where material_id = %s and student_id = %s", (material_id, user["id"]))
    if existing and existing["grade"] is not None:
        raise HTTPException(400, "Цю роботу вже оцінено")
    stored, filename, _ = await save_upload(file)
    now = datetime.now()
    if existing:
        db.execute(
            "update submissions set filename = %s, stored_name = %s, comment = %s, submitted_at = %s where id = %s",
            (filename, stored, comment.strip(), now, existing["id"]))
        submission_id = existing["id"]
    else:
        submission_id = db.insert(
            "insert into submissions (material_id, student_id, filename, stored_name, comment, submitted_at) "
            "values (%s, %s, %s, %s, %s, %s)", (material_id, user["id"], filename, stored, comment.strip(), now))
    await notify([course["teacher_id"]], "submission", f"Нова здача: {user['name']}, {material['title']}",
                 f"/materials/{material_id}", key=f"sub:{submission_id}:{now.isoformat()}")
    return db.one("select * from submissions where id = %s", (submission_id,))


@router.get("/materials/{material_id}/submissions")
def list_submissions(material_id: int, user=Depends(current_user)):
    material, course = get_material(material_id, user, manage=True)
    return db.select(
        "select u.id as student_id, u.name, s.id as submission_id, s.filename, s.comment, s.feedback, "
        "s.submitted_at, s.grade from users u left join submissions s on s.student_id = u.id and s.material_id = %s "
        "where u.role = 'student' and u.grp = %s order by u.name", (material_id, course["grp"]))


def get_submission(submission_id, user):
    submission = db.one("select * from submissions where id = %s", (submission_id,))
    if not submission:
        raise HTTPException(404, "Здачу не знайдено")
    material, course = get_material(submission["material_id"], user)
    return submission, material, course


@router.put("/submissions/{submission_id}/grade")
async def grade_submission(submission_id: int, body: GradeIn, user=Depends(current_user)):
    submission, material, course = get_submission(submission_id, user)
    if not can_manage(course, user):
        raise HTTPException(403, "У вас немає доступу до цієї сторінки")
    if body.grade > material["max_points"]:
        raise HTTPException(400, f"Оцінка не може бути вищою за {material['max_points']}")
    db.execute("update submissions set grade = %s, feedback = %s, graded_at = %s where id = %s",
               (body.grade, body.feedback.strip(), datetime.now(), submission_id))
    await notify([submission["student_id"]], "grade",
                 f"{material['title']}: ви отримали {body.grade} / {material['max_points']}",
                 f"/materials/{material['id']}", key=f"grade:{submission_id}:{body.grade}:{datetime.now().isoformat()}")
    return db.one("select * from submissions where id = %s", (submission_id,))


@router.get("/submissions/{submission_id}/file")
def submission_file(submission_id: int, user=Depends(current_user)):
    submission, material, course = get_submission(submission_id, user)
    if not can_manage(course, user) and submission["student_id"] != user["id"]:
        raise HTTPException(403, "У вас немає доступу до цього файлу")
    path = db.UPLOADS / submission["stored_name"]
    if not path.exists():
        raise HTTPException(404, "Файл не знайдено")
    return FileResponse(path, filename=submission["filename"])


@router.post("/materials/{material_id}/attachments")
async def add_attachment(material_id: int, file: UploadFile = File(...), user=Depends(current_user)):
    get_material(material_id, user, manage=True)
    stored, filename, size = await save_upload(file)
    attachment_id = db.insert(
        "insert into attachments (material_id, filename, stored_name, size, uploaded_at) values (%s, %s, %s, %s, %s)",
        (material_id, filename, stored, size, datetime.now()))
    return db.one("select id, filename, size, uploaded_at from attachments where id = %s", (attachment_id,))


def get_attachment(attachment_id, user, manage=False):
    attachment = db.one("select * from attachments where id = %s", (attachment_id,))
    if not attachment:
        raise HTTPException(404, "Вкладення не знайдено")
    get_material(attachment["material_id"], user, manage=manage)
    return attachment


@router.get("/attachments/{attachment_id}/file")
def attachment_file(attachment_id: int, user=Depends(current_user)):
    attachment = get_attachment(attachment_id, user)
    path = db.UPLOADS / attachment["stored_name"]
    if not path.exists():
        raise HTTPException(404, "Файл не знайдено")
    return FileResponse(path, filename=attachment["filename"])


@router.delete("/attachments/{attachment_id}")
def delete_attachment(attachment_id: int, user=Depends(current_user)):
    attachment = get_attachment(attachment_id, user, manage=True)
    db.execute("delete from attachments where id = %s", (attachment_id,))
    (db.UPLOADS / attachment["stored_name"]).unlink(missing_ok=True)
    return {"ok": True}
