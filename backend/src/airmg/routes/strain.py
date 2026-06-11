from __future__ import annotations
from datetime import date, timedelta
from fastapi import APIRouter
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range

router = APIRouter(prefix="/api/strain", tags=["strain"])

@router.get("/{day}")
def strain_detail(day: str):
    conn = get_connection(DB_PATH)
    daily = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (day,)).fetchone()
    trend_start = (date.fromisoformat(day) - timedelta(days=6)).isoformat()
    trend = get_daily_metrics_range(conn, trend_start, day)
    conn.close()
    if daily is None:
        return {"status": "no_data"}
    return {
        "day": day,
        "strain": daily["strain"],
        "calories": daily["calories"],
        "trend": [{"day": d["day"], "strain": d["strain"]} for d in trend],
    }
