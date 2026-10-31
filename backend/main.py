from contextlib import asynccontextmanager

from fastapi import FastAPI

import ai
import auth
import chat
import courses
import db
import seed


@asynccontextmanager
async def lifespan(app):
    db.init()
    if not db.one("select id from users limit 1"):
        seed.seed()
    yield


app = FastAPI(title="VNS", lifespan=lifespan)

@app.get("/")
def root():
    return {"message": "This is the VNS API. The site is at http://localhost:5173, API docs at /docs"}


app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(chat.router)
app.include_router(ai.router)
