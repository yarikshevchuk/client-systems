from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import db
from auth import current_user, teacher_only

router = APIRouter(prefix="/api")

MAX_UPLOAD = 20 * 1024 * 1024


def get_course(course_id, user):
    course = db.one("select * from courses where id = ?", (course_id,))
    if not course:
        raise HTTPException(404, "Course not found")
    if user["role"] == "teacher":
        allowed = course["teacher_id"] == user["id"]
    else:
        allowed = course["grp"] == user["grp"]
    if not allowed:
        raise HTTPException(403, "You do not have access to this course")
    return course


def get_material(material_id, user):
    material = db.one(
        "select m.*, t.course_id, t.title as topic_title from materials m "
        "join topics t on t.id = m.topic_id where m.id = ?", (material_id,))
    if not material:
        raise HTTPException(404, "Material not found")
    get_course(material["course_id"], user)
    return material


def course_progress(student_id, course_id):
    labs = db.select(
        "select m.id, m.title, m.deadline, m.max_points, s.id as submission_id, s.grade, s.submitted_at "
        "from materials m join topics t on t.id = m.topic_id "
        "left join submissions s on s.material_id = m.id and s.student_id = ? "
        "where t.course_id = ? and m.kind = 'lab' order by t.position, m.id", (student_id, course_id))
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


class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    grp: str = Field(min_length=1, max_length=50)


class TopicIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class MaterialIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: Literal["lecture", "lab"]
    content: str = ""
    deadline: Optional[str] = None
    max_points: int = Field(default=0, ge=0, le=1000)


class GradeIn(BaseModel):
    grade: int = Field(ge=0)


@router.get("/courses")
def list_courses(user=Depends(current_user)):
    if user["role"] == "teacher":
        courses = db.select("select * from courses where teacher_id = ? order by id", (user["id"],))
    else:
        courses = db.select("select * from courses where grp = ? order by id", (user["grp"],))
    for course in courses:
        course["teacher"] = db.one("select name from users where id = ?", (course["teacher_id"],))["name"]
    return courses


@router.post("/courses")
def create_course(body: CourseIn, user=Depends(teacher_only)):
    course_id = db.execute(
        "insert into courses (title, teacher_id, grp) values (?, ?, ?)",
        (body.title.strip(), user["id"], body.grp.strip()))
    db.execute("insert into ai_settings (course_id) values (?)", (course_id,))
    return db.one("select * from courses where id = ?", (course_id,))


@router.get("/courses/{course_id}")
def course_detail(course_id: int, user=Depends(current_user)):
    course = get_course(course_id, user)
    course["teacher"] = db.one("select name from users where id = ?", (course["teacher_id"],))["name"]
    topics = db.select("select * from topics where course_id = ? order by position, id", (course_id,))
    for topic in topics:
        topic["materials"] = db.select(
            "select id, title, kind, deadline, max_points from materials where topic_id = ? order by id",
            (topic["id"],))
    return {"course": course, "topics": topics}


@router.post("/courses/{course_id}/topics")
def create_topic(course_id: int, body: TopicIn, user=Depends(teacher_only)):
    get_course(course_id, user)
    last = db.one("select max(position) as p from topics where course_id = ?", (course_id,))["p"] or 0
    topic_id = db.execute(
        "insert into topics (course_id, title, position) values (?, ?, ?)",
        (course_id, body.title.strip(), last + 1))
    return db.one("select * from topics where id = ?", (topic_id,))


@router.post("/topics/{topic_id}/materials")
def create_material(topic_id: int, body: MaterialIn, user=Depends(teacher_only)):
    topic = db.one("select * from topics where id = ?", (topic_id,))
    if not topic:
        raise HTTPException(404, "Topic not found")
    get_course(topic["course_id"], user)
    is_lab = body.kind == "lab"
    material_id = db.execute(
        "insert into materials (topic_id, title, kind, content, deadline, max_points) values (?, ?, ?, ?, ?, ?)",
        (topic_id, body.title.strip(), body.kind, body.content,
         (body.deadline or None) if is_lab else None, body.max_points if is_lab else 0))
    return db.one("select * from materials where id = ?", (material_id,))


@router.get("/materials/{material_id}")
def material_detail(material_id: int, user=Depends(current_user)):
    material = get_material(material_id, user)
    material["submission"] = None
    if user["role"] == "student":
        material["submission"] = db.one(
            "select * from submissions where material_id = ? and student_id = ?", (material_id, user["id"]))
    settings = db.one("select * from ai_settings where course_id = ?", (material["course_id"],))
    material["ai"] = {"summaries_on": bool(settings["summaries_on"]), "ask_on": bool(settings["ask_on"])}
    return material


@router.post("/materials/{material_id}/submit")
def submit(material_id: int, file: UploadFile = File(...), user=Depends(current_user)):
    if user["role"] != "student":
        raise HTTPException(403, "Only students can submit work")
    material = get_material(material_id, user)
    if material["kind"] != "lab":
        raise HTTPException(400, "Only labs accept submissions")
    existing = db.one("select * from submissions where material_id = ? and student_id = ?", (material_id, user["id"]))
    if existing and existing["grade"] is not None:
        raise HTTPException(400, "This work is already graded")
    data = file.file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File is larger than 20 MB")
    filename = Path(file.filename or "report").name
    (db.UPLOADS / f"{material_id}_{user['id']}_{filename}").write_bytes(data)
    now = datetime.now().isoformat(timespec="seconds")
    if existing:
        db.execute("update submissions set filename = ?, submitted_at = ? where id = ?",
                   (filename, now, existing["id"]))
        submission_id = existing["id"]
    else:
        submission_id = db.execute(
            "insert into submissions (material_id, student_id, filename, submitted_at) values (?, ?, ?, ?)",
            (material_id, user["id"], filename, now))
    return db.one("select * from submissions where id = ?", (submission_id,))


@router.get("/materials/{material_id}/submissions")
def list_submissions(material_id: int, user=Depends(teacher_only)):
    material = get_material(material_id, user)
    course = get_course(material["course_id"], user)
    return db.select(
        "select u.id as student_id, u.name, s.id as submission_id, s.filename, s.submitted_at, s.grade "
        "from users u left join submissions s on s.student_id = u.id and s.material_id = ? "
        "where u.role = 'student' and u.grp = ? order by u.name", (material_id, course["grp"]))


def get_submission(submission_id, user):
    submission = db.one("select * from submissions where id = ?", (submission_id,))
    if not submission:
        raise HTTPException(404, "Submission not found")
    material = get_material(submission["material_id"], user)
    return submission, material


@router.put("/submissions/{submission_id}/grade")
def grade_submission(submission_id: int, body: GradeIn, user=Depends(teacher_only)):
    submission, material = get_submission(submission_id, user)
    if body.grade > material["max_points"]:
        raise HTTPException(400, f"Grade cannot be higher than {material['max_points']}")
    db.execute("update submissions set grade = ? where id = ?", (body.grade, submission_id))
    return db.one("select * from submissions where id = ?", (submission_id,))


@router.get("/submissions/{submission_id}/file")
def submission_file(submission_id: int, user=Depends(teacher_only)):
    submission, material = get_submission(submission_id, user)
    path = db.UPLOADS / f"{submission['material_id']}_{submission['student_id']}_{submission['filename']}"
    if not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(path, filename=submission["filename"])


@router.get("/courses/{course_id}/grades")
def course_grades(course_id: int, user=Depends(current_user)):
    get_course(course_id, user)
    if user["role"] != "student":
        raise HTTPException(403, "Grades are shown to students only")
    return course_progress(user["id"], course_id)


@router.get("/me/dashboard")
def dashboard(user=Depends(current_user)):
    if user["role"] == "teacher":
        courses = db.select("select * from courses where teacher_id = ? order by id", (user["id"],))
        for course in courses:
            course["students"] = db.one(
                "select count(*) as n from users where role = 'student' and grp = ?", (course["grp"],))["n"]
            course["ungraded"] = db.one(
                "select count(*) as n from submissions s join materials m on m.id = s.material_id "
                "join topics t on t.id = m.topic_id where t.course_id = ? and s.grade is null",
                (course["id"],))["n"]
        return {"role": "teacher", "courses": courses}
    courses = db.select("select * from courses where grp = ? order by id", (user["grp"],))
    for course in courses:
        progress = course_progress(user["id"], course["id"])
        progress.pop("labs")
        course.update(progress)
        course["teacher"] = db.one("select name from users where id = ?", (course["teacher_id"],))["name"]
    deadlines = db.select(
        "select m.id, m.title, m.deadline, m.max_points, c.id as course_id, c.title as course_title "
        "from materials m join topics t on t.id = m.topic_id join courses c on c.id = t.course_id "
        "left join submissions s on s.material_id = m.id and s.student_id = ? "
        "where c.grp = ? and m.kind = 'lab' and m.deadline is not null and s.id is null "
        "order by m.deadline", (user["id"], user["grp"]))
    now = datetime.now().isoformat(timespec="minutes")
    for row in deadlines:
        row["overdue"] = row["deadline"] < now
    return {"role": "student", "courses": courses, "deadlines": deadlines}
