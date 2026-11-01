from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import db
from access import get_material
from auth import current_user

router = APIRouter(prefix="/api")

INTERVALS = {1: timedelta(minutes=10), 2: timedelta(days=1), 3: timedelta(days=3), 4: timedelta(days=7)}


class NoteIn(BaseModel):
    text: str = Field(max_length=10000)


class CardIn(BaseModel):
    material_id: int | None = None
    front: str = Field(min_length=1, max_length=1000)
    back: str = Field(min_length=1, max_length=1000)


class ReviewIn(BaseModel):
    correct: bool


@router.put("/materials/{material_id}/note")
def save_note(material_id: int, body: NoteIn, user=Depends(current_user)):
    get_material(material_id, user)
    db.execute(
        "insert into notes (user_id, material_id, text, updated_at) values (%s, %s, %s, %s) "
        "on conflict (user_id, material_id) do update set text = excluded.text, updated_at = excluded.updated_at",
        (user["id"], material_id, body.text, datetime.now()))
    return {"ok": True}


@router.get("/flashcards")
def list_cards(user=Depends(current_user)):
    cards = db.select(
        "select f.*, m.title as material_title from flashcards f left join materials m on m.id = f.material_id "
        "where f.user_id = %s order by f.due, f.id", (user["id"],))
    now = datetime.now()
    for card in cards:
        card["is_due"] = card["due"] <= now
    return {"cards": cards, "due": sum(1 for card in cards if card["is_due"])}


@router.post("/flashcards")
def create_card(body: CardIn, user=Depends(current_user)):
    if body.material_id:
        get_material(body.material_id, user)
    card_id = db.insert(
        "insert into flashcards (user_id, material_id, front, back, due, created_at) values (%s, %s, %s, %s, %s, %s)",
        (user["id"], body.material_id, body.front.strip(), body.back.strip(), datetime.now(), datetime.now()))
    return db.one("select * from flashcards where id = %s", (card_id,))


def own_card(card_id, user):
    card = db.one("select * from flashcards where id = %s and user_id = %s", (card_id, user["id"]))
    if not card:
        raise HTTPException(404, "Картку не знайдено")
    return card


@router.delete("/flashcards/{card_id}")
def delete_card(card_id: int, user=Depends(current_user)):
    own_card(card_id, user)
    db.execute("delete from flashcards where id = %s", (card_id,))
    return {"ok": True}


@router.post("/flashcards/{card_id}/review")
def review(card_id: int, body: ReviewIn, user=Depends(current_user)):
    card = own_card(card_id, user)
    box = min(4, card["box"] + 1) if body.correct else 1
    db.execute("update flashcards set box = %s, due = %s where id = %s", (box, datetime.now() + INTERVALS[box], card_id))
    return db.one("select * from flashcards where id = %s", (card_id,))
