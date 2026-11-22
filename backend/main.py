import sys

if sys.version_info < (3, 10):
    sys.exit("Потрібен Python 3.10 або новіший, а запущено " + sys.version.split()[0] + ". Див. README, розділ «Запуск»")

from contextlib import asynccontextmanager

from fastapi import FastAPI

import admin
import agent
import ai
import announcements
import auth
import courses
import db
import discussion
import dm
import live
import notifications
import recordings
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


for module in (auth, courses, submissions, announcements, discussion, dm, spaces, study, ai, agent, recordings,
               notifications, schedule, search, admin, live):
    app.include_router(module.router)
