from __future__ import annotations

from fastapi import APIRouter

from airmg.analytics.health_age import compute_health_age
from airmg.config import DB_PATH
from airmg.store.db import get_connection

router = APIRouter(prefix="/api/health-age", tags=["health-age"])


@router.get("")
def health_age():
    conn = get_connection(DB_PATH)
    result = compute_health_age(conn)
    conn.close()
    return result
