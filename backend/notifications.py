from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

import db
from auth import current_user
from notify import notify

router = APIRouter(prefix="/api")


async def make_reminders(user):
    now = datetime.now()
    rows = db.select(
        "select m.id, m.title, m.deadline from materials m join topics t on t.id = m.topic_id "
        "join courses c on c.id = t.course_id left join submissions s on s.material_id = m.id and s.student_id = %s "
        "where c.grp = %s and m.kind = 'lab' and m.deadline > %s and m.deadline <= %s and s.id is null",
        (user["id"], user["grp"], now, now + timedelta(hours=72)))
    for row in rows:
        hours = (row["deadline"] - now).total_seconds() / 3600
        bucket = 24 if hours <= 24 else 72
        await notify([user["id"]], "reminder", f"{row['title']}: до дедлайну менше {bucket} годин",
                     f"/materials/{row['id']}", key=f"due{bucket}:{row['id']}")


@router.get("/notifications")
async def list_notifications(user=Depends(current_user)):
    if user["role"] == "student":
        await make_reminders(user)
    items = db.select("select * from notifications where user_id = %s order by created_at desc, id desc limit 50", (user["id"],))
    return {"items": items, "unread": sum(1 for item in items if not item["read"])}


@router.post("/notifications/read-all")
def read_all(user=Depends(current_user)):
    db.execute("update notifications set read = true where user_id = %s", (user["id"],))
    return {"ok": True}


@router.post("/notifications/{notification_id}/read")
def read_one(notification_id: int, user=Depends(current_user)):
    db.execute("update notifications set read = true where id = %s and user_id = %s", (notification_id, user["id"]))
    return {"ok": True}


@router.get("/me/counters")
def counters(user=Depends(current_user)):
    return {
        "notifications": db.one("select count(*) as n from notifications where user_id = %s and not read", (user["id"],))["n"],
        "messages": db.one("select count(*) as n from direct_messages where recipient_id = %s and read_at is null", (user["id"],))["n"],
    }
