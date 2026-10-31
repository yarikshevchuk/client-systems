import os
import sqlite3
from contextlib import closing
from pathlib import Path

BASE = Path(__file__).parent
UPLOADS = BASE / "uploads"

SCHEMA = """
create table if not exists users (
    id integer primary key autoincrement,
    name text not null,
    email text not null unique,
    password_hash text not null,
    role text not null,
    grp text not null default ''
);
create table if not exists courses (
    id integer primary key autoincrement,
    title text not null,
    teacher_id integer not null,
    grp text not null
);
create table if not exists topics (
    id integer primary key autoincrement,
    course_id integer not null,
    title text not null,
    position integer not null
);
create table if not exists materials (
    id integer primary key autoincrement,
    topic_id integer not null,
    title text not null,
    kind text not null,
    content text not null default '',
    deadline text,
    max_points integer not null default 0
);
create table if not exists submissions (
    id integer primary key autoincrement,
    material_id integer not null,
    student_id integer not null,
    filename text not null,
    submitted_at text not null,
    grade integer,
    unique (material_id, student_id)
);
create table if not exists messages (
    id integer primary key autoincrement,
    course_id integer not null,
    user_id integer not null,
    text text not null,
    is_question integer not null default 0,
    created_at text not null
);
create table if not exists ai_settings (
    course_id integer primary key,
    summaries_on integer not null default 0,
    ask_on integer not null default 0
);
create table if not exists ai_summaries (
    material_id integer primary key,
    text text not null
);
"""


def path():
    return os.environ.get("APP_DB", str(BASE / "app.db"))


def init():
    UPLOADS.mkdir(exist_ok=True)
    with closing(sqlite3.connect(path())) as conn:
        conn.executescript(SCHEMA)


def select(sql, args=()):
    with closing(sqlite3.connect(path())) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(sql, args).fetchall()]


def one(sql, args=()):
    rows = select(sql, args)
    return rows[0] if rows else None


def execute(sql, args=()):
    with closing(sqlite3.connect(path())) as conn:
        cursor = conn.execute(sql, args)
        conn.commit()
        return cursor.lastrowid
