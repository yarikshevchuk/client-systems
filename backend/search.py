from fastapi import APIRouter, Depends, Query

import db
from access import contacts, course_ids
from auth import current_user

router = APIRouter(prefix="/api")


@router.get("/search")
def search(q: str = Query(default=""), user=Depends(current_user)):
    q = q.strip()
    result = {"courses": [], "materials": [], "announcements": [], "messages": [], "spaces": [], "people": []}
    if len(q) < 2:
        return result
    pattern = f"%{q}%"
    ids = course_ids(user)
    if ids:
        result["courses"] = db.select(
            "select id, title, description from courses where id = any(%s) and (title ilike %s or description ilike %s) limit 8",
            (ids, pattern, pattern))
        result["materials"] = db.select(
            "select m.id, m.title, m.kind, c.title as course_title from materials m "
            "join topics t on t.id = m.topic_id join courses c on c.id = t.course_id "
            "where c.id = any(%s) and (m.title ilike %s or m.content ilike %s) limit 8", (ids, pattern, pattern))
        result["announcements"] = db.select(
            "select a.id, a.title, a.course_id, c.title as course_title from announcements a "
            "join courses c on c.id = a.course_id where a.course_id = any(%s) and (a.title ilike %s or a.body ilike %s) limit 8",
            (ids, pattern, pattern))
        result["messages"] = db.select(
            "select m.id, m.text, m.course_id, m.channel, c.title as course_title, u.name as author from messages m "
            "join courses c on c.id = m.course_id join users u on u.id = m.user_id "
            "where m.course_id = any(%s) and m.text ilike %s order by m.created_at desc limit 8", (ids, pattern))
    result["spaces"] = db.select(
        "select id, title, topic from spaces where title ilike %s or topic ilike %s or description ilike %s limit 8",
        (pattern, pattern, pattern))
    result["people"] = [row for row in contacts(user) if q.lower() in row["name"].lower()][:8]
    return result
