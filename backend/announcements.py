from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import db
from access import get_course, manage_course, member_ids
from auth import current_user
from live import hub
from notify import notify

router = APIRouter(prefix="/api")


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    pinned: bool = False


def get_announcement(announcement_id, user, manage=False):
    row = db.one("select * from announcements where id = %s", (announcement_id,))
    if not row:
        raise HTTPException(404, "Оголошення не знайдено")
    course = manage_course(row["course_id"], user) if manage else get_course(row["course_id"], user)
    return row, course


@router.get("/courses/{course_id}/announcements")
def list_announcements(course_id: int, user=Depends(current_user)):
    course = get_course(course_id, user)
    rows = db.select(
        "select a.*, u.name as author, "
        "exists (select 1 from announcement_reads r where r.announcement_id = a.id and r.user_id = %s) as read, "
        "(select count(*) from announcement_reads r where r.announcement_id = a.id) as reads "
        "from announcements a join users u on u.id = a.author_id where a.course_id = %s "
        "order by a.pinned desc, a.created_at desc", (user["id"], course_id))
    total = len(member_ids(course)) - 1
    for row in rows:
        row["audience"] = total
    return rows


@router.post("/courses/{course_id}/announcements")
async def create_announcement(course_id: int, body: AnnouncementIn, user=Depends(current_user)):
    course = manage_course(course_id, user)
    announcement_id = db.insert(
        "insert into announcements (course_id, author_id, title, body, pinned, created_at) values (%s, %s, %s, %s, %s, %s)",
        (course_id, user["id"], body.title.strip(), body.body.strip(), body.pinned, datetime.now()))
    db.execute("insert into announcement_reads (announcement_id, user_id, read_at) values (%s, %s, %s)",
               (announcement_id, user["id"], datetime.now()))
    others = [uid for uid in member_ids(course) if uid != user["id"]]
    await notify(others, "announcement", f"{course['title']}: {body.title.strip()}", f"/courses/{course_id}?tab=announcements")
    await hub.send(others, {"type": "announcement", "course_id": course_id})
    return db.one("select * from announcements where id = %s", (announcement_id,))


@router.post("/announcements/{announcement_id}/read")
def mark_read(announcement_id: int, user=Depends(current_user)):
    get_announcement(announcement_id, user)
    db.execute(
        "insert into announcement_reads (announcement_id, user_id, read_at) values (%s, %s, %s) "
        "on conflict do nothing", (announcement_id, user["id"], datetime.now()))
    return {"ok": True}


@router.post("/announcements/{announcement_id}/pin")
def toggle_pin(announcement_id: int, user=Depends(current_user)):
    row, _ = get_announcement(announcement_id, user, manage=True)
    db.execute("update announcements set pinned = %s where id = %s", (not row["pinned"], announcement_id))
    return {"pinned": not row["pinned"]}


@router.delete("/announcements/{announcement_id}")
def delete_announcement(announcement_id: int, user=Depends(current_user)):
    get_announcement(announcement_id, user, manage=True)
    db.execute("delete from announcements where id = %s", (announcement_id,))
    return {"ok": True}


@router.get("/announcements/{announcement_id}/readers")
def readers(announcement_id: int, user=Depends(current_user)):
    row, course = get_announcement(announcement_id, user, manage=True)
    return db.select(
        "select u.id, u.name, r.read_at from users u "
        "left join announcement_reads r on r.user_id = u.id and r.announcement_id = %s "
        "where u.role = 'student' and u.grp = %s order by u.name", (announcement_id, course["grp"]))
