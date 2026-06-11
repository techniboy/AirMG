from __future__ import annotations
from fastapi import APIRouter, Query
from airmg.config import DB_PATH
from airmg.store.db import get_connection

router = APIRouter(prefix="/api/workouts", tags=["workouts"])

@router.get("")
def list_workouts(limit: int = Query(20, le=100), offset: int = Query(0, ge=0)):
    conn = get_connection(DB_PATH)
    rows = conn.execute(
        "SELECT * FROM workouts ORDER BY start_ts DESC LIMIT ? OFFSET ?", (limit, offset)
    ).fetchall()
    conn.close()
    return {"workouts": [dict(r) for r in rows]}

@router.get("/{workout_id}")
def workout_detail(workout_id: int):
    conn = get_connection(DB_PATH)
    row = conn.execute("SELECT * FROM workouts WHERE id = ?", (workout_id,)).fetchone()
    conn.close()
    if row is None:
        return {"status": "not_found"}
    return dict(row)
