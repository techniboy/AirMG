from __future__ import annotations
from datetime import date, timedelta
from fastapi import APIRouter
from airmg.analytics.correlation import CorrelationEngine
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range

router = APIRouter(prefix="/api/insights", tags=["insights"])

@router.get("")
def insights():
    conn = get_connection(DB_PATH)
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=89)).isoformat()
    days = get_daily_metrics_range(conn, start, end)
    correlations = []
    if len(days) >= 10:
        metric_pairs = [
            ("strain", "recovery", 1),
            ("hrv_rmssd", "recovery", 0),
            ("sleep_performance", "recovery", 0),
        ]
        for x_key, y_key, lag in metric_pairs:
            x = {d["day"]: d[x_key] for d in days if d.get(x_key) is not None}
            y = {d["day"]: d[y_key] for d in days if d.get(y_key) is not None}
            if lag > 0:
                result = CorrelationEngine.lagged(x, y, lag_days=lag)
            else:
                pairs = CorrelationEngine.align_by_day(x, y)
                result = CorrelationEngine.pearson(pairs)
            if result:
                correlations.append({
                    "x": x_key, "y": y_key, "lag": lag,
                    "r": round(result.r, 3), "n": result.n,
                    "p": round(result.p_approx, 4),
                })
    conn.close()
    return {"correlations": correlations}
