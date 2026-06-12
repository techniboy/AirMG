from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_all_baselines, get_daily_metrics_range, normalize_daily_metrics

router = APIRouter(prefix="/api/recovery", tags=["recovery"])


@router.get("/{day}")
def recovery_detail(day: str):
    conn = get_connection(DB_PATH)
    daily = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (day,)).fetchone()
    baselines = get_all_baselines(conn)
    trend_start = (date.fromisoformat(day) - timedelta(days=13)).isoformat()
    trend = get_daily_metrics_range(conn, trend_start, day)
    conn.close()
    if daily is None:
        return {"status": "no_data"}
    daily = normalize_daily_metrics(dict(daily))
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
