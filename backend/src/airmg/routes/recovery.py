from __future__ import annotations

import sqlite3
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from airmg.store.db import get_db
from airmg.store.reads import get_all_baselines, get_daily_metrics, get_daily_metrics_range

router = APIRouter(prefix="/api/recovery", tags=["recovery"])


@router.get("/{day}")
def recovery_detail(day: str, conn: sqlite3.Connection = Depends(get_db)):
    daily = get_daily_metrics(conn, day)
    baselines = get_all_baselines(conn)
    trend_start = (date.fromisoformat(day) - timedelta(days=13)).isoformat()
    trend = get_daily_metrics_range(conn, trend_start, day)
    if daily is None:
        return {"status": "no_data"}
    return {
        "day": day,
        "recovery": daily["recovery"],
        "hrv_rmssd": daily["hrv_rmssd"],
        "resting_hr": daily["resting_hr"],
        "resp_rate": daily["resp_rate"],
        "sleep_performance": daily["sleep_performance"],
        "baselines": baselines,
        "trend": [{"day": d["day"], "recovery": d["recovery"]} for d in trend],
    }
