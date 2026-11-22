from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import db
from access import can_manage, get_course, get_material, manage_course
from auth import current_user, teacher_only

router = APIRouter(prefix="/api")


class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    grp: str = Field(min_length=1, max_length=50)


class TopicIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class MaterialIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: Literal["lecture", "lab"]
    content: str = ""
    deadline: Optional[str] = None
    max_points: int = Field(default=0, ge=0, le=1000)
    ai_on: bool = True


class MoveIn(BaseModel):
    direction: Literal["up", "down"]


def course_progress(student_id, course_id):
    labs = db.select(
        "select m.id, m.title, m.deadline, m.max_points, s.id as submission_id, s.grade, s.feedback, s.submitted_at "
        "from materials m join topics t on t.id = m.topic_id "
        "left join submissions s on s.material_id = m.id and s.student_id = %s "
        "where t.course_id = %s and m.kind = 'lab' order by t.position, m.id", (student_id, course_id))
    earned = sum(lab["grade"] for lab in labs if lab["grade"] is not None)
    graded_max = sum(lab["max_points"] for lab in labs if lab["grade"] is not None)
    total_max = sum(lab["max_points"] for lab in labs)
    return {
        "labs": labs,
        "earned": earned,
        "graded_max": graded_max,
        "total_max": total_max,
        "percent_graded": round(100 * earned / graded_max) if graded_max else None,
    }


def parse_deadline(kind, value):
    if kind != "lab" or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, "Невірний формат дедлайну")


@router.get("/courses")
def list_courses(user=Depends(current_user)):
    if user["role"] == "admin":
        courses = db.select("select * from courses order by id")
    elif user["role"] == "teacher":
        courses = db.select("select * from courses where teacher_id = %s order by id", (user["id"],))
    else:
        courses = db.select("select * from courses where grp = %s order by id", (user["grp"],))
    for course in courses:
        course["teacher"] = db.one("select name from users where id = %s", (course["teacher_id"],))["name"]
    return courses


@router.post("/courses")
def create_course(body: CourseIn, user=Depends(teacher_only)):
    course_id = db.insert(
        "insert into courses (title, description, teacher_id, grp, created_at) values (%s, %s, %s, %s, %s)",
        (body.title.strip(), body.description.strip(), user["id"], body.grp.strip(), datetime.now()))
    db.execute("insert into ai_settings (course_id) values (%s)", (course_id,))
    return db.one("select * from courses where id = %s", (course_id,))


@router.get("/courses/{course_id}")
def course_detail(course_id: int, user=Depends(current_user)):
    course = get_course(course_id, user)
    course["teacher"] = db.one("select name from users where id = %s", (course["teacher_id"],))["name"]
    student = user["role"] == "student"
    topics = db.select("select * from topics where course_id = %s order by position, id", (course_id,))
    for topic in topics:
        topic["materials"] = db.select(
            "select m.id, m.title, m.kind, m.deadline, m.max_points, s.id as submission_id, s.grade "
            "from materials m left join submissions s on s.material_id = m.id and s.student_id = %s "
            "where m.topic_id = %s order by m.id", (user["id"] if student else 0, topic["id"]))
    return {"course": course, "topics": topics, "can_manage": can_manage(course, user)}


@router.put("/courses/{course_id}")
def update_course(course_id: int, body: CourseIn, user=Depends(current_user)):
    manage_course(course_id, user)
    db.execute("update courses set title = %s, description = %s, grp = %s where id = %s",
               (body.title.strip(), body.description.strip(), body.grp.strip(), course_id))
    return db.one("select * from courses where id = %s", (course_id,))


@router.delete("/courses/{course_id}")
def delete_course(course_id: int, user=Depends(current_user)):
    manage_course(course_id, user)
    db.execute("delete from courses where id = %s", (course_id,))
    return {"ok": True}


@router.post("/courses/{course_id}/topics")
def create_topic(course_id: int, body: TopicIn, user=Depends(current_user)):
    manage_course(course_id, user)
    last = db.one("select max(position) as p from topics where course_id = %s", (course_id,))["p"] or 0
    topic_id = db.insert("insert into topics (course_id, title, position) values (%s, %s, %s)",
                         (course_id, body.title.strip(), last + 1))
    return db.one("select * from topics where id = %s", (topic_id,))


def get_topic(topic_id, user):
    topic = db.one("select * from topics where id = %s", (topic_id,))
    if not topic:
        raise HTTPException(404, "Тему не знайдено")
    manage_course(topic["course_id"], user)
    return topic


@router.put("/topics/{topic_id}")
def update_topic(topic_id: int, body: TopicIn, user=Depends(current_user)):
    get_topic(topic_id, user)
    db.execute("update topics set title = %s where id = %s", (body.title.strip(), topic_id))
    return db.one("select * from topics where id = %s", (topic_id,))


@router.delete("/topics/{topic_id}")
def delete_topic(topic_id: int, user=Depends(current_user)):
    get_topic(topic_id, user)
    db.execute("delete from topics where id = %s", (topic_id,))
    return {"ok": True}


@router.post("/topics/{topic_id}/move")
def move_topic(topic_id: int, body: MoveIn, user=Depends(current_user)):
    topic = get_topic(topic_id, user)
    topics = db.select("select id, position from topics where course_id = %s order by position, id", (topic["course_id"],))
    index = next(i for i, row in enumerate(topics) if row["id"] == topic_id)
    other = index - 1 if body.direction == "up" else index + 1
    if 0 <= other < len(topics):
        topics[index], topics[other] = topics[other], topics[index]
        for position, row in enumerate(topics, 1):
            db.execute("update topics set position = %s where id = %s", (position, row["id"]))
    return {"ok": True}


@router.post("/topics/{topic_id}/materials")
def create_material(topic_id: int, body: MaterialIn, user=Depends(current_user)):
    get_topic(topic_id, user)
    is_lab = body.kind == "lab"
    material_id = db.insert(
        "insert into materials (topic_id, title, kind, content, deadline, max_points, ai_on, created_at) "
        "values (%s, %s, %s, %s, %s, %s, %s, %s)",
        (topic_id, body.title.strip(), body.kind, body.content, parse_deadline(body.kind, body.deadline),
         body.max_points if is_lab else 0, body.ai_on, datetime.now()))
    return db.one("select * from materials where id = %s", (material_id,))


@router.put("/materials/{material_id}")
def update_material(material_id: int, body: MaterialIn, user=Depends(current_user)):
    get_material(material_id, user, manage=True)
    is_lab = body.kind == "lab"
    db.execute(
        "update materials set title = %s, kind = %s, content = %s, deadline = %s, max_points = %s, ai_on = %s where id = %s",
        (body.title.strip(), body.kind, body.content, parse_deadline(body.kind, body.deadline),
         body.max_points if is_lab else 0, body.ai_on, material_id))
    return db.one("select * from materials where id = %s", (material_id,))


@router.delete("/materials/{material_id}")
def delete_material(material_id: int, user=Depends(current_user)):
    get_material(material_id, user, manage=True)
    db.execute("delete from materials where id = %s", (material_id,))
    return {"ok": True}


@router.get("/materials/{material_id}")
def material_detail(material_id: int, user=Depends(current_user)):
    material, course = get_material(material_id, user)
    material["submission"] = None
    if user["role"] == "student":
        material["submission"] = db.one(
            "select * from submissions where material_id = %s and student_id = %s", (material_id, user["id"]))
    settings = db.one("select * from ai_settings where course_id = %s", (course["id"],))
    material["ai"] = {key: bool(settings[key]) for key in ("summaries_on", "ask_on", "flashcards_on")}
    material["attachments"] = db.select(
        "select id, filename, size, uploaded_at from attachments where material_id = %s order by id", (material_id,))
    note = db.one("select text, updated_at from notes where user_id = %s and material_id = %s", (user["id"], material_id))
    material["note"] = note["text"] if note else ""
    material["can_manage"] = can_manage(course, user)
    material["course_title"] = course["title"]
    return material


@router.get("/courses/{course_id}/people")
def people(course_id: int, user=Depends(current_user)):
    course = get_course(course_id, user)
    teacher = db.one("select id, name, email, role, last_seen from users where id = %s", (course["teacher_id"],))
    students = db.select(
        "select id, name, email, grp, last_seen from users where role = 'student' and grp = %s order by name",
        (course["grp"],))
    return {"teacher": teacher, "students": students}


@router.get("/courses/{course_id}/grades")
def course_grades(course_id: int, user=Depends(current_user)):
    get_course(course_id, user)
    if user["role"] != "student":
        raise HTTPException(403, "Оцінки показуються лише студентам")
    return course_progress(user["id"], course_id)


@router.get("/courses/{course_id}/gradebook")
def gradebook(course_id: int, user=Depends(current_user)):
    course = manage_course(course_id, user)
    labs = db.select(
        "select m.id, m.title, m.deadline, m.max_points from materials m join topics t on t.id = m.topic_id "
        "where t.course_id = %s and m.kind = 'lab' order by t.position, m.id", (course_id,))
    students = db.select(
        "select id, name, last_seen from users where role = 'student' and grp = %s order by name", (course["grp"],))
    submissions = db.select(
        "select s.id, s.material_id, s.student_id, s.grade, s.submitted_at from submissions s "
        "join materials m on m.id = s.material_id join topics t on t.id = m.topic_id where t.course_id = %s",
        (course_id,))
    by_key = {(row["material_id"], row["student_id"]): row for row in submissions}
    now = datetime.now()
    total_max = sum(lab["max_points"] for lab in labs)
    for student in students:
        cells = [by_key.get((lab["id"], student["id"])) for lab in labs]
        graded = [(c, lab) for c, lab in zip(cells, labs) if c and c["grade"] is not None]
        student["cells"] = cells
        student["earned"] = sum(c["grade"] for c, _ in graded)
        student["graded_max"] = sum(lab["max_points"] for _, lab in graded)
        student["percent_graded"] = round(100 * student["earned"] / student["graded_max"]) if student["graded_max"] else None
        student["submitted"] = sum(1 for c in cells if c)
        student["overdue"] = sum(1 for c, lab in zip(cells, labs) if not c and lab["deadline"] and lab["deadline"] < now)
        reasons = []
        if student["overdue"]:
            reasons.append(f"не здано вчасно: {student['overdue']}")
        if student["percent_graded"] is not None and student["percent_graded"] < 60:
            reasons.append(f"середній результат {student['percent_graded']} %")
        student["at_risk"] = bool(reasons)
        student["risk_reasons"] = reasons
    for index, lab in enumerate(labs):
        cells = [student["cells"][index] for student in students]
        grades = [c["grade"] for c in cells if c and c["grade"] is not None]
        lab["submitted"] = sum(1 for c in cells if c)
        lab["on_time"] = sum(1 for c in cells if c and lab["deadline"] and c["submitted_at"] <= lab["deadline"])
        lab["graded"] = len(grades)
        lab["average"] = round(sum(grades) / len(grades), 1) if grades else None
    return {"labs": labs, "students": students, "total_max": total_max}


@router.get("/me/dashboard")
def dashboard(user=Depends(current_user)):
    if user["role"] in ("teacher", "admin"):
        if user["role"] == "admin":
            courses = db.select("select * from courses order by id")
        else:
            courses = db.select("select * from courses where teacher_id = %s order by id", (user["id"],))
        for course in courses:
            course["students"] = db.one(
                "select count(*) as n from users where role = 'student' and grp = %s", (course["grp"],))["n"]
            course["ungraded"] = db.one(
                "select count(*) as n from submissions s join materials m on m.id = s.material_id "
                "join topics t on t.id = m.topic_id where t.course_id = %s and s.grade is null",
                (course["id"],))["n"]
        recent = db.select(
            "select s.id, s.material_id, s.submitted_at, u.name as student, m.title, c.title as course_title "
            "from submissions s join users u on u.id = s.student_id join materials m on m.id = s.material_id "
            "join topics t on t.id = m.topic_id join courses c on c.id = t.course_id "
            "where s.grade is null and (c.teacher_id = %s or %s) order by s.submitted_at desc limit 6",
            (user["id"], user["role"] == "admin"))
        return {"role": user["role"], "courses": courses, "recent": recent}
    courses = db.select("select * from courses where grp = %s order by id", (user["grp"],))
    for course in courses:
        progress = course_progress(user["id"], course["id"])
        progress.pop("labs")
        course.update(progress)
        course["teacher"] = db.one("select name from users where id = %s", (course["teacher_id"],))["name"]
    deadlines = db.select(
        "select m.id, m.title, m.deadline, m.max_points, c.id as course_id, c.title as course_title "
        "from materials m join topics t on t.id = m.topic_id join courses c on c.id = t.course_id "
        "left join submissions s on s.material_id = m.id and s.student_id = %s "
        "where c.grp = %s and m.kind = 'lab' and m.deadline is not null and s.id is null "
        "order by m.deadline", (user["id"], user["grp"]))
    now = datetime.now()
    for row in deadlines:
        row["overdue"] = row["deadline"] < now
    announcements = db.select(
        "select a.id, a.title, a.created_at, a.course_id, c.title as course_title, "
        "exists (select 1 from announcement_reads r where r.announcement_id = a.id and r.user_id = %s) as read "
        "from announcements a join courses c on c.id = a.course_id where c.grp = %s "
        "order by a.created_at desc limit 4", (user["id"], user["grp"]))
    due_cards = db.one("select count(*) as n from flashcards where user_id = %s and due <= %s", (user["id"], now))["n"]
    return {"role": "student", "courses": courses, "deadlines": deadlines, "announcements": announcements,
            "due_cards": due_cards}
