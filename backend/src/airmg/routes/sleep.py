from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_samples_range

router = APIRouter(prefix="/api/sleep", tags=["sleep"])


@router.get("/{day}")
def sleep_detail(day: str):
    conn = get_connection(DB_PATH)
    start_ts = int(datetime.strptime(day, "%Y-%m-%d").timestamp())
    end_ts = start_ts + 86400
    row = conn.execute(
        "SELECT * FROM sleep_sessions"
        " WHERE start_ts >= ? AND start_ts < ?"
        " ORDER BY start_ts DESC LIMIT 1",
        (start_ts - 43200, end_ts),
    ).fetchone()
    daily = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (day,)).fetchone()
    if row is None:
        conn.close()
        return {"status": "no_data"}
    session = dict(row)
    stages = []
    if session.get("stages_json"):
        stages = json.loads(session["stages_json"])
        session["stages"] = stages
        del session["stages_json"]
    duration = session["end_ts"] - session["start_ts"]
    session["sleep_minutes"] = duration // 60
    deep = sum(s["end"] - s["start"] for s in stages if s["stage"] == "deep")
    rem = sum(s["end"] - s["start"] for s in stages if s["stage"] == "rem")
    light = sum(s["end"] - s["start"] for s in stages if s["stage"] == "light")
    wake = sum(s["end"] - s["start"] for s in stages if s["stage"] == "wake")
    session["deep_minutes"] = deep // 60 if stages else None
    session["rem_minutes"] = rem // 60 if stages else None
    session["light_minutes"] = light // 60 if stages else None
    session["wake_minutes"] = wake // 60 if stages else None
    if not session.get("resting_hr"):
        hr_samples = get_samples_range(
            conn, "hr", session["start_ts"], session["end_ts"]
        )
        if hr_samples:
            values = sorted(s["value"] for s in hr_samples)
            p5_idx = max(0, len(values) * 5 // 100)
            session["resting_hr"] = round(values[p5_idx])
    if daily:
        sp = daily["sleep_performance"]
        session["sleep_performance"] = (
            round(sp * 100) if sp is not None and sp <= 1 else sp
        )
        if not session.get("resting_hr"):
            session["resting_hr"] = daily["resting_hr"]
        session["avg_hrv"] = session.get("avg_hrv") or daily["hrv_rmssd"]
    conn.close()
    return session
