from __future__ import annotations
import sqlite3
from datetime import date

def get_samples_range(conn: sqlite3.Connection, sample_type: str, start_ts: int, end_ts: int) -> list[dict]:
    rows = conn.execute("SELECT type, ts, value FROM samples WHERE type = ? AND ts >= ? AND ts <= ? ORDER BY ts", (sample_type, start_ts, end_ts)).fetchall()
    return [dict(r) for r in rows]

def get_sleep_sessions_range(conn: sqlite3.Connection, start_ts: int, end_ts: int) -> list[dict]:
    rows = conn.execute("SELECT * FROM sleep_sessions WHERE start_ts >= ? AND end_ts <= ? ORDER BY start_ts", (start_ts, end_ts)).fetchall()
    return [dict(r) for r in rows]

def get_workouts_range(conn: sqlite3.Connection, start_ts: int, end_ts: int) -> list[dict]:
    rows = conn.execute("SELECT * FROM workouts WHERE start_ts >= ? AND end_ts <= ? ORDER BY start_ts", (start_ts, end_ts)).fetchall()
    return [dict(r) for r in rows]

def get_daily_metrics_range(conn: sqlite3.Connection, start_day: str, end_day: str) -> list[dict]:
    rows = conn.execute("SELECT * FROM daily_metrics WHERE day >= ? AND day <= ? ORDER BY day", (start_day, end_day)).fetchall()
    return [dict(r) for r in rows]

def get_today_metrics(conn: sqlite3.Connection) -> dict | None:
    today = date.today().isoformat()
    row = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (today,)).fetchone()
    return dict(row) if row else None

def get_baseline(conn: sqlite3.Connection, metric: str) -> dict | None:
    row = conn.execute("SELECT * FROM baselines WHERE metric = ?", (metric,)).fetchone()
    return dict(row) if row else None

def get_all_baselines(conn: sqlite3.Connection) -> dict[str, dict]:
    rows = conn.execute("SELECT * FROM baselines").fetchall()
    return {r["metric"]: dict(r) for r in rows}

def get_journal_entries(conn: sqlite3.Connection, day: str) -> list[dict]:
    rows = conn.execute("SELECT * FROM journal_entries WHERE day = ? ORDER BY question_key", (day,)).fetchall()
    return [dict(r) for r in rows]

def get_steps_range(conn: sqlite3.Connection, start_day: str, end_day: str) -> list[dict]:
    rows = conn.execute("SELECT * FROM steps WHERE day >= ? AND day <= ? ORDER BY day", (start_day, end_day)).fetchall()
    return [dict(r) for r in rows]

def get_sync_state(conn: sqlite3.Connection, data_type: str) -> dict | None:
    row = conn.execute("SELECT * FROM sync_state WHERE data_type = ?", (data_type,)).fetchone()
    return dict(row) if row else None

def get_profile(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM profile WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None
