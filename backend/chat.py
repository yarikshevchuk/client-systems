from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

import auth
import courses
import db
from auth import current_user

router = APIRouter()


class Rooms:
    def __init__(self):
        self.sockets = {}

    async def join(self, course_id, socket):
        await socket.accept()
        self.sockets.setdefault(course_id, set()).add(socket)

    def leave(self, course_id, socket):
        self.sockets.get(course_id, set()).discard(socket)

    async def broadcast(self, course_id, data):
        for socket in list(self.sockets.get(course_id, ())):
            try:
                await socket.send_json(data)
            except Exception:
                self.leave(course_id, socket)


rooms = Rooms()

MESSAGE_SQL = (
    "select m.id, m.course_id, m.user_id, u.name as author, u.role, m.text, m.is_question, m.created_at "
    "from messages m join users u on u.id = m.user_id")


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    is_question: bool = False


@router.get("/api/courses/{course_id}/messages")
def list_messages(course_id: int, user=Depends(current_user)):
    courses.get_course(course_id, user)
    rows = db.select(MESSAGE_SQL + " where m.course_id = ? order by m.id desc limit 100", (course_id,))
    return list(reversed(rows))


@router.post("/api/courses/{course_id}/messages")
async def post_message(course_id: int, body: MessageIn, user=Depends(current_user)):
    courses.get_course(course_id, user)
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Message is empty")
    message_id = db.execute(
        "insert into messages (course_id, user_id, text, is_question, created_at) values (?, ?, ?, ?, ?)",
        (course_id, user["id"], text, int(body.is_question), datetime.now().isoformat(timespec="seconds")))
    message = db.one(MESSAGE_SQL + " where m.id = ?", (message_id,))
    await rooms.broadcast(course_id, message)
    return message


@router.websocket("/ws/{course_id}")
async def course_socket(socket: WebSocket, course_id: int, token: str = ""):
    user = auth.user_from_token(token) if token else None
    try:
        if not user:
            raise HTTPException(401, "Not authenticated")
        courses.get_course(course_id, user)
    except HTTPException:
        await socket.close(code=1008)
        return
    await rooms.join(course_id, socket)
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        rooms.leave(course_id, socket)
