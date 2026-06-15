from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from airmg.store.db import get_db
from airmg.store.reads import get_all_baselines

router = APIRouter(prefix="/api", tags=["baselines"])


@router.get("/baselines")
def baselines(conn: sqlite3.Connection = Depends(get_db)):
    rows = get_all_baselines(conn)
    return {
        metric: {
            "mean": round(data["mean"], 2),
            "spread": round(data["spread"], 2),
            "status": data["status"],
        }
        for metric, data in rows.items()
    }
