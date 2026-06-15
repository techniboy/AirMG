from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, Query

from airmg.store.db import get_db
from airmg.store.reads import get_daily_metrics_range

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("")
def trends(
    start: str = Query(..., description="yyyy-MM-dd"),
    end: str = Query(..., description="yyyy-MM-dd"),
    metrics: str = Query("recovery,strain,hrv_rmssd", description="comma-separated metric names"),
    conn: sqlite3.Connection = Depends(get_db),
):
    days = get_daily_metrics_range(conn, start, end)
    keys = [m.strip() for m in metrics.split(",")]
    return {"days": [{"day": d["day"], **{k: d.get(k) for k in keys}} for d in days]}
