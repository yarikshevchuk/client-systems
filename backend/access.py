from fastapi import HTTPException

import db


def can_manage(course, user):
    return user["role"] == "admin" or (user["role"] == "teacher" and course["teacher_id"] == user["id"])


def get_course(course_id, user):
    course = db.one("select * from courses where id = %s", (course_id,))
    if not course:
        raise HTTPException(404, "Курс не знайдено")
    if can_manage(course, user) or (user["role"] == "student" and course["grp"] == user["grp"]):
        return course
    raise HTTPException(403, "У вас немає доступу до цього курсу")


def manage_course(course_id, user):
    course = get_course(course_id, user)
    if not can_manage(course, user):
        raise HTTPException(403, "У вас немає доступу до цієї сторінки")
    return course


def member_ids(course):
    students = db.select("select id from users where role = 'student' and grp = %s", (course["grp"],))
    return [row["id"] for row in students] + [course["teacher_id"]]


def course_ids(user):
    if user["role"] == "admin":
        rows = db.select("select id from courses")
    elif user["role"] == "teacher":
        rows = db.select("select id from courses where teacher_id = %s", (user["id"],))
    else:
        rows = db.select("select id from courses where grp = %s", (user["grp"],))
    return [row["id"] for row in rows]


def get_material(material_id, user, manage=False):
    material = db.one(
        "select m.*, t.course_id, t.title as topic_title from materials m "
        "join topics t on t.id = m.topic_id where m.id = %s", (material_id,))
    if not material:
        raise HTTPException(404, "Матеріал не знайдено")
    course = manage_course(material["course_id"], user) if manage else get_course(material["course_id"], user)
    return material, course


def contacts(user):
    if user["role"] == "admin":
        return db.select("select id, name, role, grp from users where id <> %s order by name", (user["id"],))
    if user["role"] == "teacher":
        return db.select(
            "select distinct u.id, u.name, u.role, u.grp from users u join courses c on c.grp = u.grp "
            "where c.teacher_id = %s and u.role = 'student' order by u.name", (user["id"],))
    return db.select(
        "select distinct u.id, u.name, u.role, u.grp from users u "
        "where u.id <> %s and ((u.role = 'student' and u.grp = %s) or "
        "(u.role = 'teacher' and exists (select 1 from courses c where c.teacher_id = u.id and c.grp = %s))) "
        "order by u.name", (user["id"], user["grp"], user["grp"]))


def can_message(user, other_id):
    return any(row["id"] == other_id for row in contacts(user))
