from __future__ import annotations

import sqlite3
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query

from airmg.store.db import get_db
from airmg.store.reads import get_daily_metrics, get_daily_metrics_range, get_samples_range

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/today")
def today(
    day: str = Query(default=None, description="yyyy-MM-dd"),
    conn: sqlite3.Connection = Depends(get_db),
):
    day = day or date.today().isoformat()
    metrics = get_daily_metrics(conn, day)
    if metrics is None:
        return {"status": "no_data", "message": "No data for this day."}
    return metrics


@router.get("/week")
def week(conn: sqlite3.Connection = Depends(get_db)):
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=6)).isoformat()
    days = get_daily_metrics_range(conn, start, end)
    return {"days": days}


SPARKLINE_METRICS = [
    "recovery",
    "strain",
    "hrv_rmssd",
    "resting_hr",
    "sleep_minutes",
    "sleep_performance",
    "spo2",
    "resp_rate",
    "steps",
    "calories",
    "deep_minutes",
    "rem_minutes",
]


@router.get("/sparklines")
def sparklines(
    days: int = Query(14, ge=1, le=90),
    end_day: str = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db),
):
    if end_day:
        end = end_day
        end_dt = datetime.strptime(end_day, "%Y-%m-%d").date()
    else:
        end = date.today().isoformat()
        end_dt = date.today()
    start = (end_dt - timedelta(days=days - 1)).isoformat()
    rows = get_daily_metrics_range(conn, start, end)
    result: dict[str, list] = {m: [] for m in SPARKLINE_METRICS}
    for row in rows:
        for m in SPARKLINE_METRICS:
            result[m].append(row.get(m))
    return result


@router.get("/hr-trend")
def hr_trend(
    day: str = Query(default=None, description="yyyy-MM-dd"),
    conn: sqlite3.Connection = Depends(get_db),
):
    if day is None:
        day = date.today().isoformat()
    dt = datetime.strptime(day, "%Y-%m-%d")
    start_ts = int(dt.timestamp())
    end_ts = start_ts + 86400
    samples = get_samples_range(conn, "hr", start_ts, end_ts)
    if not samples:
        return {"points": [], "min": 0, "avg": 0, "max": 0}
    bucket_size = 300  # 5 minutes
    buckets: dict[int, list[float]] = {}
    for s in samples:
        bucket_ts = (s["ts"] // bucket_size) * bucket_size
        if bucket_ts not in buckets:
            buckets[bucket_ts] = []
        buckets[bucket_ts].append(s["value"])
    points = []
    all_bpm: list[float] = []
    for ts in sorted(buckets.keys()):
        vals = buckets[ts]
        mean_bpm = round(sum(vals) / len(vals), 1)
        points.append({"ts": ts, "bpm": mean_bpm})
        all_bpm.append(mean_bpm)
    return {
        "points": points,
        "min": round(min(all_bpm)),
        "avg": round(sum(all_bpm) / len(all_bpm)),
        "max": round(max(all_bpm)),
    }
