from __future__ import annotations

import sqlite3
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from airmg.store.db import get_db
from airmg.store.reads import get_daily_metrics, get_daily_metrics_range

router = APIRouter(prefix="/api/strain", tags=["strain"])


@router.get("/{day}")
def strain_detail(day: str, conn: sqlite3.Connection = Depends(get_db)):
    daily = get_daily_metrics(conn, day)
    trend_start = (date.fromisoformat(day) - timedelta(days=6)).isoformat()
    trend = get_daily_metrics_range(conn, trend_start, day)
    if daily is None:
        return {"status": "no_data"}
    return {
        "day": day,
        "strain": daily["strain"],
        "calories": daily["calories"],
        "trend": [{"day": d["day"], "strain": d["strain"]} for d in trend],
    }
