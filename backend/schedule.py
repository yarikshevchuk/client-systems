from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response

import db
from access import course_ids
from auth import current_user

router = APIRouter(prefix="/api")


def events(user):
    ids = course_ids(user)
    if not ids:
        return []
    rows = db.select(
        "select m.id, m.title, m.deadline, m.max_points, c.id as course_id, c.title as course_title, "
        "s.id as submission_id, s.grade from materials m join topics t on t.id = m.topic_id "
        "join courses c on c.id = t.course_id left join submissions s on s.material_id = m.id and s.student_id = %s "
        "where c.id = any(%s) and m.kind = 'lab' and m.deadline is not null order by m.deadline",
        (user["id"] if user["role"] == "student" else 0, ids))
    now = datetime.now()
    for row in rows:
        row["overdue"] = row["deadline"] < now and not row["submission_id"]
    return rows


@router.get("/calendar")
def calendar(user=Depends(current_user)):
    return events(user)


@router.get("/calendar.ics")
def calendar_ics(user=Depends(current_user)):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VNS//EN"]
    for row in events(user):
        start = row["deadline"].strftime("%Y%m%dT%H%M%S")
        lines += ["BEGIN:VEVENT", f"UID:lab-{row['id']}@vns", f"DTSTAMP:{datetime.now().strftime('%Y%m%dT%H%M%S')}",
                  f"DTSTART:{start}", f"SUMMARY:{row['title']} ({row['course_title']})", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return Response("\r\n".join(lines) + "\r\n", media_type="text/calendar",
                    headers={"Content-Disposition": 'attachment; filename="deadlines.ics"'})
