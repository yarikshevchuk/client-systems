import hashlib
import hmac
import os
import time

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

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
    return db.one("select * from users where id = ?", (int(data["sub"]),))


def public(user):
    return {key: user[key] for key in ("id", "name", "email", "role", "grp")}


def current_user(authorization: str = Header(default=None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = user_from_token(token) if token else None
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def teacher_only(user=Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(403, "You do not have access to this page")
    return user


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn):
    user = db.one("select * from users where email = ?", (body.email.strip().lower(),))
    if not user or not check_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    return {"token": make_token(user), "user": public(user)}


@router.get("/me")
def me(user=Depends(current_user)):
    return public(user)
