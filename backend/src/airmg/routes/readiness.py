from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, Query

from airmg.analytics.readiness import evaluate
from airmg.store.db import get_db

router = APIRouter(prefix="/api", tags=["readiness"])


@router.get("/readiness")
def get_readiness(
    day: str = Query(default=None, description="yyyy-MM-dd"),
    conn: sqlite3.Connection = Depends(get_db),
):
    # FastAPI serializes the ReadinessResult dataclass (and nested Signals) directly.
    return evaluate(conn, day)
