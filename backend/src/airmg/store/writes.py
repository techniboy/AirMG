from __future__ import annotations

import sqlite3
import time
from typing import Any


def upsert_samples(conn: sqlite3.Connection, samples: list[dict[str, Any]]) -> int:
    sql = """INSERT INTO samples (type, ts, value, source) VALUES (:type, :ts, :value, :source)
        ON CONFLICT(type, ts) DO UPDATE SET value = excluded.value"""
    count = 0
    for s in samples:
        s.setdefault("source", "google-health")
        conn.execute(sql, s)
        count += 1
    conn.commit()
    return count


def upsert_sleep_session(
    conn: sqlite3.Connection,
    start_ts: int,
    end_ts: int,
    efficiency: float | None = None,
    stages_json: str | None = None,
    resting_hr: int | None = None,
    avg_hrv: float | None = None,
    source: str = "google-health",
) -> None:
    conn.execute(
        "INSERT INTO sleep_sessions"
        " (start_ts, end_ts, efficiency, stages_json,"
        " resting_hr, avg_hrv, source)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)"
        " ON CONFLICT(start_ts, end_ts) DO UPDATE SET"
        " efficiency=excluded.efficiency,"
        " stages_json=excluded.stages_json,"
        " resting_hr=excluded.resting_hr,"
        " avg_hrv=excluded.avg_hrv",
        (start_ts, end_ts, efficiency, stages_json, resting_hr, avg_hrv, source),
    )
    conn.commit()


def upsert_workout(
    conn: sqlite3.Connection,
    start_ts: int,
    end_ts: int,
    workout_type: str | None = None,
    calories: float | None = None,
    avg_hr: int | None = None,
    max_hr: int | None = None,
    strain: float | None = None,
    source: str = "google-health",
) -> None:
    conn.execute(
        """INSERT INTO workouts (start_ts, end_ts, type, calories, avg_hr, max_hr, strain, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(start_ts, end_ts) DO UPDATE SET
             type=excluded.type, calories=excluded.calories, avg_hr=excluded.avg_hr,
             max_hr=excluded.max_hr, strain=excluded.strain""",
        (start_ts, end_ts, workout_type, calories, avg_hr, max_hr, strain, source),
    )
    conn.commit()


def upsert_daily_metrics(conn: sqlite3.Connection, data: dict[str, Any]) -> None:
    cols = [
        "day",
        "recovery",
        "strain",
        "sleep_performance",
        "hrv_rmssd",
        "resting_hr",
        "resp_rate",
        "spo2",
        "skin_temp",
        "steps",
        "calories",
        "sleep_minutes",
        "deep_minutes",
        "rem_minutes",
        "light_minutes",
        "wake_minutes",
    ]
    present = {k: data.get(k) for k in cols if k in data}
    keys = list(present.keys())
    placeholders = ", ".join(f":{k}" for k in keys)
    updates = ", ".join(f"{k}=excluded.{k}" for k in keys if k != "day")
    sql = (
        f"INSERT INTO daily_metrics ({', '.join(keys)})"
        f" VALUES ({placeholders})"
        f" ON CONFLICT(day) DO UPDATE SET {updates}"
    )
    conn.execute(sql, present)
    conn.commit()


def upsert_baseline(
    conn: sqlite3.Connection,
    metric: str,
    mean: float,
    spread: float,
    n_valid: int,
    nights_since_update: int = 0,
    status: str = "calibrating",
) -> None:
    conn.execute(
        "INSERT INTO baselines"
        " (metric, mean, spread, n_valid, nights_since_update, status, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)"
        " ON CONFLICT(metric) DO UPDATE SET"
        " mean=excluded.mean, spread=excluded.spread,"
        " n_valid=excluded.n_valid,"
        " nights_since_update=excluded.nights_since_update,"
        " status=excluded.status, updated_at=excluded.updated_at",
        (metric, mean, spread, n_valid, nights_since_update, status, int(time.time())),
    )
    conn.commit()


def upsert_journal_entry(
    conn: sqlite3.Connection,
    day: str,
    question_key: str,
    answer: str,
    created_at: int | None = None,
) -> None:
    conn.execute(
        """INSERT INTO journal_entries (day, question_key, answer, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(day, question_key) DO UPDATE SET answer=excluded.answer""",
        (day, question_key, answer, created_at or int(time.time())),
    )
    conn.commit()


def upsert_steps(
    conn: sqlite3.Connection, day: str, total: int, source: str = "google-health"
) -> None:
    conn.execute(
        "INSERT INTO steps (day, total, source) VALUES (?, ?, ?)"
        " ON CONFLICT(day) DO UPDATE SET total=excluded.total",
        (day, total, source),
    )
    conn.commit()


def set_sync_state(
    conn: sqlite3.Connection, data_type: str, last_synced_ts: int, last_token: str | None = None
) -> None:
    conn.execute(
        "INSERT INTO sync_state (data_type, last_synced_ts, last_token)"
        " VALUES (?, ?, ?)"
        " ON CONFLICT(data_type) DO UPDATE SET"
        " last_synced_ts=excluded.last_synced_ts,"
        " last_token=excluded.last_token",
        (data_type, last_synced_ts, last_token),
    )
    conn.commit()


def set_profile(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO profile (key, value) VALUES (?, ?)"
        " ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()
