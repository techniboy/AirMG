from __future__ import annotations
from fastapi import APIRouter
from airmg.coach.engine import CoachEngine
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_today_metrics

router = APIRouter(prefix="/api/coach", tags=["coach"])

@router.get("")
def coach():
    conn = get_connection(DB_PATH)
    today = get_today_metrics(conn)
    conn.close()
    if today is None:
        return {"recommendations": []}
    recs = CoachEngine.recommendations(
        recovery=today.get("recovery"),
        strain=today.get("strain"),
        sleep_perf=today.get("sleep_performance"),
    )
    return {
        "recommendations": [
            {"category": r.category, "message": r.message, "priority": r.priority} for r in recs
        ]
    }
