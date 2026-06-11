from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range, get_today_metrics

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/today")
def today():
    conn = get_connection(DB_PATH)
    metrics = get_today_metrics(conn)
    conn.close()
    if metrics is None:
        return {"status": "no_data", "message": "No data for today. Sync first."}
    return metrics


@router.get("/week")
def week():
    conn = get_connection(DB_PATH)
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=6)).isoformat()
    days = get_daily_metrics_range(conn, start, end)
    conn.close()
    return {"days": days}
