from __future__ import annotations

import sqlite3
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from airmg.store.db import get_db
from airmg.store.reads import get_sync_state
from airmg.store.writes import (
    set_sync_state,
    upsert_samples,
    upsert_sleep_session,
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
        "filter_field": "heart_rate.sample_time.physical_time",
        "mapper": map_heart_rate,
    },
    "hrv": {
        "api_type": "daily-heart-rate-variability",
        "filter_field": None,
        "mapper": map_hrv,
    },
    "sleep": {
        "api_type": "sleep",
        "filter_field": "sleep.interval.end_time",
        "mapper": map_sleep_sessions,
    },
    "spo2": {
        "api_type": "oxygen-saturation",
        "filter_field": "oxygen_saturation.sample_time.physical_time",
        "mapper": map_spo2,
    },
    "workouts": {
        "api_type": "exercise",
        "filter_field": None,
        "mapper": map_workouts,
    },
    "steps": {
        "api_type": "steps",
        "filter_field": "steps.interval.start_time",
        "mapper": map_steps,
    },
}
DEFAULT_LOOKBACK_DAYS = 90


def _deduplicate_step_intervals(intervals: list[dict]) -> list[dict]:
    """Keep only granular (<=60s) intervals, discard overlapping summaries."""
    return [iv for iv in intervals if (iv.get("end_ts", iv["ts"]) - iv["ts"]) <= 60]


def _fetch_and_persist(
    conn: sqlite3.Connection,
    key: str,
    cfg: dict,
    start_dt: datetime,
    end_dt: datetime,
) -> int:
    start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_iso = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    raw = fetch_data_points(
        cfg["api_type"],
        start_iso=start_iso,
        end_iso=end_iso,
        filter_field=cfg["filter_field"],
    )
    mapped = cfg["mapper"](raw)
    if cfg["filter_field"] is None:
        start_ts = int(start_dt.timestamp())
        mapped = [m for m in mapped if m.get("ts", m.get("start_ts", 0)) >= start_ts]
    if key == "sleep":
        for s in mapped:
            upsert_sleep_session(conn, **s)
    elif key == "workouts":
        for w in mapped:
            upsert_workout(conn, **w)
    elif key == "steps":
        deduped = _deduplicate_step_intervals(mapped)
        upsert_samples(
            conn,
            [
                {"type": "steps", "ts": s["ts"], "value": s["value"], "source": "google-health"}
                for s in deduped
            ],
        )
    else:
        upsert_samples(conn, mapped)
    return len(mapped)


def _recompute_metrics(conn: sqlite3.Connection, start_dt: datetime, end_dt: datetime) -> None:
    from airmg.analytics.pipeline import compute_daily_metrics

    # Iterate calendar dates inclusive — a timedelta .days floors and drops the
    # final partial day, so an overnight sync (last night → this morning) would
    # skip today and leave today's metrics stale.
    day = start_dt.date()
    last = end_dt.date()
    while day <= last:
        compute_daily_metrics(conn, day.isoformat())
        day += timedelta(days=1)


@router.post("/start")
def start_sync(conn: sqlite3.Connection = Depends(get_db)):
    results = {}
    now = int(time.time())
    earliest_start = datetime.utcnow()
    for key, cfg in DATA_TYPES.items():
        state = get_sync_state(conn, key)
        if state and state["last_synced_ts"]:
            start_dt = datetime.utcfromtimestamp(state["last_synced_ts"])
        else:
            start_dt = datetime.utcnow() - timedelta(days=DEFAULT_LOOKBACK_DAYS)
        end_dt = datetime.utcnow()
        if start_dt < earliest_start:
            earliest_start = start_dt
        try:
            count = _fetch_and_persist(conn, key, cfg, start_dt, end_dt)
            set_sync_state(conn, key, now)
            results[key] = count
        except Exception as exc:
            results[key] = {"error": str(exc)}
            continue
    _recompute_metrics(conn, earliest_start, datetime.utcnow())
    return {"synced": results}


@router.post("/range")
def sync_range(
    start: str = Query(description="yyyy-MM-dd"),
    end: str = Query(description="yyyy-MM-dd"),
    conn: sqlite3.Connection = Depends(get_db),
):
    start_dt = datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end) + timedelta(days=1)
    results = {}
    for key, cfg in DATA_TYPES.items():
        try:
            count = _fetch_and_persist(conn, key, cfg, start_dt, end_dt)
            results[key] = count
        except Exception as exc:
            results[key] = {"error": str(exc)}
            continue
    _recompute_metrics(conn, start_dt, end_dt)
    return {"synced": results}


@router.get("/status")
def sync_status(conn: sqlite3.Connection = Depends(get_db)):
    states = {}
    for key in DATA_TYPES:
        s = get_sync_state(conn, key)
        states[key] = {
            "last_synced": datetime.fromtimestamp(s["last_synced_ts"]).isoformat()
            if s and s["last_synced_ts"]
            else None,
        }
    return {"sync_states": states}
