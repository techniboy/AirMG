from __future__ import annotations

import time
from datetime import date, datetime, timedelta

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_sync_state
from airmg.store.writes import (
    set_sync_state,
    upsert_samples,
    upsert_sleep_session,
    upsert_steps,
    upsert_workout,
)
from airmg.sync.client import fetch_data_points
from airmg.sync.mapper import (
    map_heart_rate,
    map_hrv,
    map_sleep_sessions,
    map_spo2,
    map_steps,
    map_workouts,
)

router = APIRouter(prefix="/sync", tags=["sync"])

DATA_TYPES = {
    "heart_rate": {
        "api_type": "heart-rate",
        "filter_field": "heartRate.sampleTime.physicalTime",
        "mapper": map_heart_rate,
    },
    "hrv": {
        "api_type": "daily-heart-rate-variability",
        "filter_field": "dailyHeartRateVariability.date",
        "mapper": map_hrv,
    },
    "sleep": {
        "api_type": "sleep",
        "filter_field": "sleep.interval.startTime",
        "mapper": map_sleep_sessions,
    },
    "spo2": {
        "api_type": "oxygen-saturation",
        "filter_field": "oxygenSaturation.sampleTime.physicalTime",
        "mapper": map_spo2,
    },
    "workouts": {
        "api_type": "exercise",
        "filter_field": "exercise.interval.startTime",
        "mapper": map_workouts,
    },
    "steps": {
        "api_type": "steps",
        "filter_field": "steps.interval.startTime",
        "mapper": map_steps,
    },
}
DEFAULT_LOOKBACK_DAYS = 90


@router.post("/start")
def start_sync():
    conn = get_connection(DB_PATH)
    results = {}
    now = int(time.time())
    for key, cfg in DATA_TYPES.items():
        state = get_sync_state(conn, key)
        if state and state["last_synced_ts"]:
            start_dt = datetime.utcfromtimestamp(state["last_synced_ts"])
        else:
            start_dt = datetime.utcnow() - timedelta(days=DEFAULT_LOOKBACK_DAYS)
        end_dt = datetime.utcnow()
        start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        end_iso = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            raw = fetch_data_points(cfg["api_type"])
        except Exception as exc:
            results[key] = {"error": str(exc)}
            continue
        mapped = cfg["mapper"](raw)
        if key == "sleep":
            for s in mapped:
                upsert_sleep_session(conn, **s)
        elif key == "workouts":
            for w in mapped:
                upsert_workout(conn, **w)
        elif key == "steps":
            for s in mapped:
                day_str = date.fromtimestamp(s["ts"]).isoformat()
                upsert_steps(conn, day_str, s["value"])
        else:
            upsert_samples(conn, mapped)
        set_sync_state(conn, key, now)
        results[key] = len(mapped)
    from airmg.analytics.pipeline import compute_daily_metrics

    for d in range(min(DEFAULT_LOOKBACK_DAYS, 14)):
        day_str = (date.today() - timedelta(days=d)).isoformat()
        compute_daily_metrics(conn, day_str)
    conn.close()
    return {"synced": results}


@router.get("/status")
def sync_status():
    conn = get_connection(DB_PATH)
    states = {}
    for key in DATA_TYPES:
        s = get_sync_state(conn, key)
        states[key] = {
            "last_synced": datetime.fromtimestamp(s["last_synced_ts"]).isoformat()
            if s and s["last_synced_ts"]
            else None,
        }
    conn.close()
    return {"sync_states": states}
