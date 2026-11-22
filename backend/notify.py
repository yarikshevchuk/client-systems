from datetime import datetime

import db
from live import hub


async def notify(user_ids, kind, text, link="", key=None):
    for user_id in set(user_ids):
        row = db.one(
            "insert into notifications (user_id, kind, text, link, key, created_at) values (%s, %s, %s, %s, %s, %s) "
            "on conflict (user_id, key) do nothing returning *",
            (user_id, kind, text, link, key, datetime.now()))
        if row:
            await hub.send([user_id], {"type": "notification", "notification": row})
