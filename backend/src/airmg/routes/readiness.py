# backend/src/airmg/routes/readiness.py
from __future__ import annotations

from fastapi import APIRouter, Query

from airmg.analytics.readiness import ReadinessEngine
from airmg.config import DB_PATH
from airmg.store.db import get_connection

router = APIRouter(prefix="/api", tags=["readiness"])


@router.get("/readiness")
def get_readiness(day: str = Query(default=None, description="yyyy-MM-dd")):
    conn = get_connection(DB_PATH)
    result = ReadinessEngine.evaluate(conn, day)
    conn.close()
    return result.to_dict()
