import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

import ai
import db
from access import can_manage, get_material
from auth import current_user

router = APIRouter(prefix="/api")

MAX_AUDIO = 100 * 1024 * 1024

SELECT = ("select r.id, r.material_id, r.author_id, r.title, r.mime, r.duration, r.segments, r.summary, r.shared, "
          "r.created_at, u.name as author from recordings r join users u on u.id = r.author_id")


def clean_segments(raw):
    try:
        data = json.loads(raw)
        items = []
        for item in data[:5000]:
            text = str(item["text"]).strip()
            if text:
                items.append({"start": round(max(0.0, float(item["start"])), 2), "text": text[:1000]})
    except (ValueError, KeyError, TypeError):
        raise HTTPException(422, "Невірний формат тексту запису")
    return sorted(items, key=lambda item: item["start"])


def get_recording(recording_id, user):
    recording = db.one(SELECT + " where r.id = %s", (recording_id,))
    if not recording:
        raise HTTPException(404, "Запис не знайдено")
    material, course = get_material(recording["material_id"], user)
    if not (recording["shared"] or recording["author_id"] == user["id"] or can_manage(course, user)):
        raise HTTPException(403, "У вас немає доступу до цього запису")
    return recording, material, course


@router.post("/materials/{material_id}/recordings")
async def create_recording(material_id: int, title: str = Form(default=""), duration: float = Form(default=0),
                           segments: str = Form(default="[]"), audio: UploadFile = File(...), user=Depends(current_user)):
    material, course = get_material(material_id, user)
    if material["kind"] != "lecture":
        raise HTTPException(400, "Записи додаються до лекцій")
    data = await audio.read()
    if not data:
        raise HTTPException(422, "Аудіо порожнє")
    if len(data) > MAX_AUDIO:
        raise HTTPException(413, "Запис більший за 100 МБ")
    stored = uuid.uuid4().hex
    (db.UPLOADS / stored).write_bytes(data)
    recording_id = db.insert(
        "insert into recordings (material_id, author_id, title, stored_name, mime, duration, segments, shared, created_at) "
        "values (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)",
        (material_id, user["id"], title.strip() or f"Запис від {datetime.now():%d.%m %H:%M}", stored,
         audio.content_type or "audio/webm", max(0.0, duration), json.dumps(clean_segments(segments)),
         can_manage(course, user), datetime.now()))
    return db.one(SELECT + " where r.id = %s", (recording_id,))


@router.get("/materials/{material_id}/recordings")
def list_recordings(material_id: int, user=Depends(current_user)):
    material, course = get_material(material_id, user)
    rows = db.select(SELECT + " where r.material_id = %s order by r.created_at desc", (material_id,))
    return [row for row in rows if row["shared"] or row["author_id"] == user["id"] or can_manage(course, user)]


@router.get("/recordings/{recording_id}/audio")
def recording_audio(recording_id: int, user=Depends(current_user)):
    recording, _, _ = get_recording(recording_id, user)
    path = db.UPLOADS / db.one("select stored_name from recordings where id = %s", (recording_id,))["stored_name"]
    if not path.exists():
        raise HTTPException(404, "Файл не знайдено")
    return FileResponse(path, media_type=recording["mime"])


@router.delete("/recordings/{recording_id}")
def delete_recording(recording_id: int, user=Depends(current_user)):
    recording, _, course = get_recording(recording_id, user)
    if recording["author_id"] != user["id"] and not can_manage(course, user):
        raise HTTPException(403, "Видалити запис може його автор або викладач")
    stored = db.one("select stored_name from recordings where id = %s", (recording_id,))["stored_name"]
    db.execute("delete from recordings where id = %s", (recording_id,))
    (db.UPLOADS / stored).unlink(missing_ok=True)
    return {"ok": True}


@router.post("/recordings/{recording_id}/summary")
def recording_summary(recording_id: int, user=Depends(current_user)):
    recording, material, course = get_recording(recording_id, user)
    if not ai.get_settings(course["id"])["summaries_on"]:
        raise HTTPException(403, "Викладач вимкнув AI-конспекти для цього курсу")
    if recording["summary"]:
        return {"summary": recording["summary"], "cached": True}
    transcript = " ".join(item["text"] for item in recording["segments"])
    if not transcript.strip():
        raise HTTPException(400, "У записі немає розпізнаного тексту")
    ai.spend(user)
    text, demo = ai.make_summary(recording["title"], transcript)
    db.execute("update recordings set summary = %s where id = %s", (text, recording_id))
    return {"summary": text, "cached": False, "demo": demo}


@router.post("/recordings/{recording_id}/append")
def append_to_lecture(recording_id: int, user=Depends(current_user)):
    recording, material, course = get_recording(recording_id, user)
    if not can_manage(course, user):
        raise HTTPException(403, "Додати текст до лекції може лише викладач")
    transcript = " ".join(item["text"] for item in recording["segments"])
    if not transcript.strip():
        raise HTTPException(400, "У записі немає розпізнаного тексту")
    db.execute("delete from ai_summaries where material_id = %s", (material["id"],))
    db.execute("update materials set content = content || %s where id = %s",
               (("\n\n" if material["content"] else "") + transcript, material["id"]))
    return {"content": db.one("select content from materials where id = %s", (material["id"],))["content"]}
