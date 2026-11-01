import hashlib
import hmac
import os
import time
from datetime import datetime
from typing import Literal

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

import db

SECRET = os.environ.get("APP_SECRET", "dev-secret-change-me-dev-secret-change-me")

router = APIRouter(prefix="/api")


def hash_password(password):
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + "$" + digest.hex()


def check_password(password, stored):
    salt_hex, digest_hex = stored.split("$")
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 100_000)
    return hmac.compare_digest(digest.hex(), digest_hex)


def make_token(user):
    return jwt.encode({"sub": str(user["id"]), "exp": time.time() + 7 * 24 * 3600}, SECRET, algorithm="HS256")


def user_from_token(token):
    try:
        data = jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return db.one("select * from users where id = %s", (int(data["sub"]),))


def public(user):
    return {key: user[key] for key in ("id", "name", "email", "role", "grp", "bio")}


def current_user(authorization: str = Header(default=None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = user_from_token(token) if token else None
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def teacher_only(user=Depends(current_user)):
    if user["role"] not in ("teacher", "admin"):
        raise HTTPException(403, "You do not have access to this page")
    return user


def admin_only(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "You do not have access to this page")
    return user


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=4, max_length=100)
    role: Literal["student", "teacher"] = "student"
    grp: str = Field(default="", max_length=50)


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    bio: str = Field(default="", max_length=500)
    grp: str = Field(default="", max_length=50)


class PasswordIn(BaseModel):
    old: str
    new: str = Field(min_length=4, max_length=100)


@router.post("/register")
def register(body: RegisterIn):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(422, "Enter a valid email")
    if body.role == "student" and not body.grp.strip():
        raise HTTPException(422, "Students must enter their group")
    if db.one("select id from users where email = %s", (email,)):
        raise HTTPException(409, "This email is already registered")
    user_id = db.insert(
        "insert into users (name, email, password_hash, role, grp, created_at) values (%s, %s, %s, %s, %s, %s)",
        (body.name.strip(), email, hash_password(body.password), body.role,
         body.grp.strip() if body.role == "student" else "", datetime.now()))
    user = db.one("select * from users where id = %s", (user_id,))
    return {"token": make_token(user), "user": public(user)}


@router.post("/login")
def login(body: LoginIn):
    user = db.one("select * from users where email = %s", (body.email.strip().lower(),))
    if not user or not check_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    return {"token": make_token(user), "user": public(user)}


@router.get("/me")
def me(user=Depends(current_user)):
    db.execute("update users set last_seen = %s where id = %s", (datetime.now(), user["id"]))
    return public(user)


@router.put("/me")
def update_me(body: ProfileIn, user=Depends(current_user)):
    grp = body.grp.strip() if user["role"] == "student" else ""
    if user["role"] == "student" and not grp:
        raise HTTPException(422, "Students must enter their group")
    db.execute("update users set name = %s, bio = %s, grp = %s where id = %s",
               (body.name.strip(), body.bio.strip(), grp, user["id"]))
    return public(db.one("select * from users where id = %s", (user["id"],)))


@router.put("/me/password")
def change_password(body: PasswordIn, user=Depends(current_user)):
    if not check_password(body.old, user["password_hash"]):
        raise HTTPException(400, "The current password is wrong")
    db.execute("update users set password_hash = %s where id = %s", (hash_password(body.new), user["id"]))
    return {"ok": True}
