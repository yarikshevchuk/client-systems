from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder

import auth

router = APIRouter()


class Hub:
    def __init__(self):
        self.sockets = {}

    async def connect(self, user_id, socket):
        await socket.accept()
        self.sockets.setdefault(user_id, set()).add(socket)

    def disconnect(self, user_id, socket):
        self.sockets.get(user_id, set()).discard(socket)

    async def send(self, user_ids, event):
        data = jsonable_encoder(event)
        for user_id in set(user_ids):
            for socket in list(self.sockets.get(user_id, ())):
                try:
                    await socket.send_json(data)
                except Exception:
                    self.disconnect(user_id, socket)


hub = Hub()


@router.websocket("/ws")
async def live(socket: WebSocket, token: str = ""):
    user = auth.user_from_token(token) if token else None
    if not user:
        await socket.close(code=1008)
        return
    await hub.connect(user["id"], socket)
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(user["id"], socket)
