from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from airmg.coach.engine import recommendations as coach_recommendations
from airmg.store.db import get_db
from airmg.store.reads import get_today_metrics

router = APIRouter(prefix="/api/coach", tags=["coach"])


@router.get("")
def coach(conn: sqlite3.Connection = Depends(get_db)):
    today = get_today_metrics(conn)
    if today is None:
        return {"recommendations": []}
    recs = coach_recommendations(
        recovery=today.get("recovery"),
        strain=today.get("strain"),
        sleep_perf=today.get("sleep_performance"),
    )
    return {
        "recommendations": [
            {"category": r.category, "message": r.message, "priority": r.priority} for r in recs
        ]
    }
