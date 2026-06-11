from __future__ import annotations
import time
from datetime import date, datetime, timedelta
from fastapi import APIRouter
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_sync_state
from airmg.store.writes import set_sync_state, upsert_samples, upsert_sleep_session, upsert_workout
from airmg.sync.client import fetch_data_points
from airmg.sync.mapper import map_heart_rate, map_hrv, map_sleep_sessions, map_spo2, map_workouts

router = APIRouter(prefix="/sync", tags=["sync"])

DATA_TYPES = {
    "heart_rate": ("com.google.heart_rate.bpm", map_heart_rate),
    "hrv": ("com.google.heart_rate.variability", map_hrv),
    "sleep": ("com.google.sleep.segment", map_sleep_sessions),
    "spo2": ("com.google.oxygen_saturation", map_spo2),
    "workouts": ("com.google.activity.segment", map_workouts),
}
DEFAULT_LOOKBACK_DAYS = 90

@router.post("/start")
def start_sync():
    conn = get_connection(DB_PATH)
    results = {}
    now = int(time.time())
    for key, (data_type, mapper) in DATA_TYPES.items():
        state = get_sync_state(conn, key)
        if state and state["last_synced_ts"]:
            start_ts = state["last_synced_ts"]
        else:
            start_ts = int((datetime.now() - timedelta(days=DEFAULT_LOOKBACK_DAYS)).timestamp())
        raw = fetch_data_points(data_type, start_ts, now)
        mapped = mapper(raw)
        if key == "sleep":
            for s in mapped:
                upsert_sleep_session(conn, **s)
        elif key == "workouts":
            for w in mapped:
                upsert_workout(conn, **w)
        else:
            upsert_samples(conn, mapped)
        set_sync_state(conn, key, now)
        results[key] = len(mapped)
    # compute daily metrics after sync
    from airmg.analytics.pipeline import compute_daily_metrics
    compute_daily_metrics(conn, date.today().isoformat())
    conn.close()
    return {"synced": results}

@router.get("/status")
def sync_status():
    conn = get_connection(DB_PATH)
    states = {}
    for key in DATA_TYPES:
        s = get_sync_state(conn, key)
        states[key] = {
            "last_synced": datetime.fromtimestamp(s["last_synced_ts"]).isoformat() if s and s["last_synced_ts"] else None,
        }
    conn.close()
    return {"sync_states": states}
