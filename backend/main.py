from contextlib import asynccontextmanager

from fastapi import FastAPI

import admin
import ai
import announcements
import auth
import courses
import db
import discussion
import dm
import live
import notifications
import schedule
import search
import seed
import spaces
import study
import submissions


@asynccontextmanager
async def lifespan(app):
    db.init()
    if not db.one("select id from users limit 1"):
        seed.seed()
    yield


app = FastAPI(title="VNS", lifespan=lifespan)


@app.get("/")
def root():
    return {"message": "Це API платформи VNS. Сайт: http://localhost:5173, документація API: /docs"}


for module in (auth, courses, submissions, announcements, discussion, dm, spaces, study, ai,
               notifications, schedule, search, admin, live):
    app.include_router(module.router)
