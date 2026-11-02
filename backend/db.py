import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

BASE = Path(__file__).parent
UPLOADS = BASE / "uploads"

DEFAULT_URL = "postgresql://vns:vns@127.0.0.1:5440/vns"

SCHEMA = """
create table if not exists users (
    id serial primary key,
    name text not null,
    email text not null unique,
    password_hash text not null,
    role text not null check (role in ('student', 'teacher', 'admin')),
    grp text not null default '',
    bio text not null default '',
    created_at timestamp not null,
    last_seen timestamp
);
create table if not exists courses (
    id serial primary key,
    title text not null,
    description text not null default '',
    teacher_id int not null references users(id) on delete cascade,
    grp text not null,
    created_at timestamp not null
);
create table if not exists topics (
    id serial primary key,
    course_id int not null references courses(id) on delete cascade,
    title text not null,
    position int not null
);
create table if not exists materials (
    id serial primary key,
    topic_id int not null references topics(id) on delete cascade,
    title text not null,
    kind text not null check (kind in ('lecture', 'lab')),
    content text not null default '',
    deadline timestamp,
    max_points int not null default 0,
    created_at timestamp not null
);
create table if not exists attachments (
    id serial primary key,
    material_id int not null references materials(id) on delete cascade,
    filename text not null,
    stored_name text not null,
    size int not null,
    uploaded_at timestamp not null
);
create table if not exists submissions (
    id serial primary key,
    material_id int not null references materials(id) on delete cascade,
    student_id int not null references users(id) on delete cascade,
    filename text not null,
    stored_name text not null,
    comment text not null default '',
    submitted_at timestamp not null,
    grade int,
    feedback text not null default '',
    graded_at timestamp,
    unique (material_id, student_id)
);
create table if not exists announcements (
    id serial primary key,
    course_id int not null references courses(id) on delete cascade,
    author_id int not null references users(id) on delete cascade,
    title text not null,
    body text not null,
    pinned boolean not null default false,
    created_at timestamp not null
);
create table if not exists announcement_reads (
    announcement_id int not null references announcements(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    read_at timestamp not null,
    primary key (announcement_id, user_id)
);
create table if not exists messages (
    id serial primary key,
    course_id int not null references courses(id) on delete cascade,
    channel text not null check (channel in ('general', 'qa')),
    user_id int not null references users(id) on delete cascade,
    parent_id int references messages(id) on delete cascade,
    text text not null,
    accepted boolean not null default false,
    resolved boolean not null default false,
    created_at timestamp not null
);
create table if not exists direct_messages (
    id serial primary key,
    sender_id int not null references users(id) on delete cascade,
    recipient_id int not null references users(id) on delete cascade,
    text text not null,
    created_at timestamp not null,
    read_at timestamp
);
create table if not exists notifications (
    id serial primary key,
    user_id int not null references users(id) on delete cascade,
    kind text not null,
    text text not null,
    link text not null default '',
    key text,
    read boolean not null default false,
    created_at timestamp not null,
    unique (user_id, key)
);
create table if not exists spaces (
    id serial primary key,
    title text not null,
    topic text not null default '',
    description text not null default '',
    owner_id int not null references users(id) on delete cascade,
    created_at timestamp not null
);
create table if not exists space_members (
    space_id int not null references spaces(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    joined_at timestamp not null,
    primary key (space_id, user_id)
);
create table if not exists space_messages (
    id serial primary key,
    space_id int not null references spaces(id) on delete cascade,
    user_id int not null references users(id) on delete cascade,
    text text not null,
    created_at timestamp not null
);
create table if not exists notes (
    id serial primary key,
    user_id int not null references users(id) on delete cascade,
    material_id int not null references materials(id) on delete cascade,
    text text not null,
    updated_at timestamp not null,
    unique (user_id, material_id)
);
create table if not exists flashcards (
    id serial primary key,
    user_id int not null references users(id) on delete cascade,
    material_id int references materials(id) on delete set null,
    front text not null,
    back text not null,
    box int not null default 1,
    due timestamp not null,
    created_at timestamp not null
);
create table if not exists ai_settings (
    course_id int primary key references courses(id) on delete cascade,
    summaries_on boolean not null default false,
    ask_on boolean not null default false,
    flashcards_on boolean not null default false
);
create table if not exists ai_summaries (
    material_id int primary key references materials(id) on delete cascade,
    text text not null
);
create table if not exists recordings (
    id serial primary key,
    material_id int not null references materials(id) on delete cascade,
    author_id int not null references users(id) on delete cascade,
    title text not null default '',
    stored_name text not null,
    mime text not null default 'audio/webm',
    duration real not null default 0,
    segments jsonb not null default '[]',
    summary text,
    shared boolean not null default false,
    created_at timestamp not null
);
create table if not exists ai_messages (
    id serial primary key,
    user_id int not null references users(id) on delete cascade,
    course_id int not null references courses(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    text text not null,
    sources jsonb not null default '[]',
    extra jsonb not null default '{}',
    created_at timestamp not null
);
create table if not exists ai_usage (
    user_id int not null references users(id) on delete cascade,
    day date not null,
    count int not null default 0,
    primary key (user_id, day)
);
"""


def url():
    return os.environ.get("DATABASE_URL", DEFAULT_URL)


def connect():
    return psycopg.connect(url(), row_factory=dict_row, autocommit=True)


def init():
    UPLOADS.mkdir(exist_ok=True)
    with connect() as conn:
        conn.execute(SCHEMA)


def select(sql, args=()):
    with connect() as conn:
        return conn.execute(sql, args).fetchall()


def one(sql, args=()):
    rows = select(sql, args)
    return rows[0] if rows else None


def execute(sql, args=()):
    with connect() as conn:
        conn.execute(sql, args)


def insert(sql, args=()):
    with connect() as conn:
        return conn.execute(sql + " returning id", args).fetchone()["id"]
