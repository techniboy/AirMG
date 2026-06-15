"""WHOOP-Age-style biological age estimate.

WHOOP's Healthspan algorithm is proprietary; this follows its published
structure: behavioral/physiological metrics are compared against
guideline-optimal targets and each deviation is mapped to years added to or
subtracted from chronological age (hazard-ratio-in-years approach, e.g.
~+1 year per 10 bpm of resting HR above optimal).

Metrics used (of WHOOP's nine): sleep duration, sleep consistency, daily
steps, weekly zone 1-3 minutes, weekly zone 4-5 minutes, strength sessions,
resting HR. Skipped: VO2max (derived from RHR/HRmax here, would double-count)
and lean body mass (no data source).
"""

from __future__ import annotations

import sqlite3
from datetime import date, datetime, timedelta

from airmg.analytics.zones import build_zones
from airmg.store.reads import get_daily_metrics_range, get_profile

WINDOW_DAYS = 180
ZONE_WINDOW_DAYS = 30  # ponytail: HR samples are ~1Hz; 180d would be millions of rows
MAX_SAMPLE_GAP_S = 300


def _avg(vals: list[float]) -> float | None:
    return sum(vals) / len(vals) if vals else None


def _zone_minutes_per_week(
    conn: sqlite3.Connection, age: int, hr_max: float | None
) -> tuple[float, float] | None:
    end_dt = datetime.now()
    start_ts = int((end_dt - timedelta(days=ZONE_WINDOW_DAYS)).timestamp())
    rows = conn.execute(
        "SELECT ts, value FROM samples WHERE type='hr' AND ts >= ? ORDER BY ts",
        (start_ts,),
    ).fetchall()
    if len(rows) < 600:
        return None
    zone_set = build_zones(age=age, manual_max_hr=hr_max)
    z13_s = 0.0
    z45_s = 0.0
    prev_dt = 60.0
    for i, r in enumerate(rows):
        if i + 1 < len(rows):
            gap = rows[i + 1]["ts"] - r["ts"]
            dt = prev_dt if gap <= 0 else min(float(gap), MAX_SAMPLE_GAP_S)
            prev_dt = dt
        else:
            dt = prev_dt
        zn = zone_set.zone_number(float(r["value"]))
        if 1 <= zn <= 3:
            z13_s += dt
        elif zn >= 4:
            z45_s += dt
    weeks = ZONE_WINDOW_DAYS / 7.0
    return (z13_s / 60.0 / weeks, z45_s / 60.0 / weeks)


def _sleep_consistency_sd_min(conn: sqlite3.Connection, start_ts: int) -> float | None:
    rows = conn.execute(
        "SELECT start_ts FROM sleep_sessions WHERE start_ts >= ? AND (end_ts - start_ts) >= 3600",
        (start_ts,),
    ).fetchall()
    if len(rows) < 7:
        return None
    # Minutes from 18:00 so a 23:30/00:30 bedtime spread doesn't wrap around midnight
    mins = []
    for r in rows:
        t = datetime.fromtimestamp(r["start_ts"])
        m = (t.hour * 60 + t.minute - 18 * 60) % 1440
        mins.append(m)
    mean = sum(mins) / len(mins)
    var = sum((m - mean) ** 2 for m in mins) / len(mins)
    return var**0.5


def _strength_per_week(conn: sqlite3.Connection, start_ts: int) -> float:
    row = conn.execute(
        "SELECT COUNT(*) n FROM workouts WHERE start_ts >= ?"
        " AND (lower(coalesce(type,'')) LIKE '%strength%'"
        "      OR lower(coalesce(type,'')) LIKE '%weight%')",
        (start_ts,),
    ).fetchone()
    return (row["n"] if row else 0) / (WINDOW_DAYS / 7.0)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_health_age(conn: sqlite3.Connection) -> dict:
    age_str = get_profile(conn, "age")
    if not age_str:
        return {"status": "needs_profile", "message": "Set your age in Settings first."}
    age = int(age_str)
    hr_max_str = get_profile(conn, "hr_max")
    hr_max = float(hr_max_str) if hr_max_str else None

    today = date.today()
    start_day = (today - timedelta(days=WINDOW_DAYS)).isoformat()
    start_ts = int(
        datetime.combine(today - timedelta(days=WINDOW_DAYS), datetime.min.time()).timestamp()
    )
    rows = get_daily_metrics_range(conn, start_day, today.isoformat())
    if len(rows) < 14:
        return {"status": "insufficient_data", "message": "Need at least 14 days of data."}

    avg_sleep = _avg([r["sleep_minutes"] for r in rows if r.get("sleep_minutes")])
    avg_steps = _avg([float(r["steps"]) for r in rows if r.get("steps")])
    avg_rhr = _avg([float(r["resting_hr"]) for r in rows if r.get("resting_hr")])
    sd_bedtime = _sleep_consistency_sd_min(conn, start_ts)
    zones = _zone_minutes_per_week(conn, age, hr_max)
    strength_wk = _strength_per_week(conn, start_ts)

    metrics: list[dict] = []

    def add(key: str, label: str, value, target: str, delta: float | None, unit: str = ""):
        metrics.append(
            {
                "key": key,
                "label": label,
                "value": round(value, 1) if isinstance(value, float) else value,
                "unit": unit,
                "target": target,
                "delta_years": round(delta, 2) if delta is not None else None,
            }
        )

    # Each delta: years added (+) or subtracted (-) vs guideline-optimal
    if avg_rhr is not None:
        add(
            "rhr",
            "Resting Heart Rate",
            avg_rhr,
            "≤60 bpm",
            _clamp((avg_rhr - 60.0) / 10.0, -2.0, 5.0),
            "bpm",
        )
    else:
        add("rhr", "Resting Heart Rate", None, "≤60 bpm", None, "bpm")

    if avg_sleep is not None:
        h = avg_sleep / 60.0
        if h < 7:
            d = _clamp((7 - h) * 1.5, 0, 5.0)
        elif h > 9:
            d = _clamp((h - 9) * 0.5, 0, 1.0)
        else:
            d = -0.5
        add("sleep", "Sleep Duration", h, "7-9 h", d, "h")
    else:
        add("sleep", "Sleep Duration", None, "7-9 h", None, "h")

    if sd_bedtime is not None:
        d = (
            -0.5
            if sd_bedtime < 45
            else 0.0
            if sd_bedtime < 90
            else 0.5
            if sd_bedtime < 120
            else 1.0
        )
        add("consistency", "Sleep Consistency", sd_bedtime, "bedtime ±45 min", d, "min sd")
    else:
        add("consistency", "Sleep Consistency", None, "bedtime ±45 min", None, "min sd")

    if avg_steps is not None:
        if avg_steps >= 8000:
            d = -0.5 - _clamp((avg_steps - 8000) / 4000 * 0.5, 0, 0.5)
        else:
            d = _clamp((8000 - avg_steps) / 2000 * 0.75, 0, 3.0)
        add("steps", "Daily Steps", avg_steps, "≥8,000", d)
    else:
        add("steps", "Daily Steps", None, "≥8,000", None)

    if zones is not None:
        z13, z45 = zones
        d13 = -1.0 if z13 >= 150 else _clamp((150 - z13) / 150 * 2.0, 0, 2.0)
        d45 = -1.0 if z45 >= 75 else _clamp((75 - z45) / 75 * 1.5, 0, 1.5)
        add("zone13", "Zone 1-3 (weekly)", z13, "≥150 min/wk", d13, "min")
        add("zone45", "Zone 4-5 (weekly)", z45, "≥75 min/wk", d45, "min")
    else:
        add("zone13", "Zone 1-3 (weekly)", None, "≥150 min/wk", None, "min")
        add("zone45", "Zone 4-5 (weekly)", None, "≥75 min/wk", None, "min")

    d = -1.0 if strength_wk >= 2 else -0.5 if strength_wk >= 1 else 0.5
    add("strength", "Strength Sessions", strength_wk, "≥2 /wk", d, "/wk")

    total = _clamp(
        sum(m["delta_years"] for m in metrics if m["delta_years"] is not None), -10.0, 15.0
    )
    health_age = max(18.0, age + total)

    return {
        "status": "ok",
        "chronological_age": age,
        "health_age": round(health_age, 1),
        "delta_years": round(total, 1),
        "window_days": WINDOW_DAYS,
        "metrics": metrics,
    }
