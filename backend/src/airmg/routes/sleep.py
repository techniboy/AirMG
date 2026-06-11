from __future__ import annotations
import json
from datetime import datetime
from fastapi import APIRouter
from airmg.config import DB_PATH
from airmg.store.db import get_connection

router = APIRouter(prefix="/api/sleep", tags=["sleep"])

@router.get("/{day}")
def sleep_detail(day: str):
    conn = get_connection(DB_PATH)
    start_ts = int(datetime.strptime(day, "%Y-%m-%d").timestamp())
    end_ts = start_ts + 86400
    row = conn.execute(
        "SELECT * FROM sleep_sessions WHERE start_ts >= ? AND start_ts < ? ORDER BY start_ts DESC LIMIT 1",
        (start_ts - 43200, end_ts),
    ).fetchone()
    daily = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (day,)).fetchone()
    conn.close()
    if row is None:
        return {"status": "no_data"}
    session = dict(row)
    if session.get("stages_json"):
        session["stages"] = json.loads(session["stages_json"])
        del session["stages_json"]
    if daily:
        session["sleep_minutes"] = daily["sleep_minutes"]
        session["deep_minutes"] = daily["deep_minutes"]
        session["rem_minutes"] = daily["rem_minutes"]
        session["light_minutes"] = daily["light_minutes"]
    return session
