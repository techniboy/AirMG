from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from airmg.analytics.health_age import compute_health_age
from airmg.store.db import get_db

router = APIRouter(prefix="/api/health-age", tags=["health-age"])


@router.get("")
def health_age(conn: sqlite3.Connection = Depends(get_db)):
    result = compute_health_age(conn)
    return result
