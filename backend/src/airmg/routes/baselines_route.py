# backend/src/airmg/routes/baselines_route.py
from __future__ import annotations
from fastapi import APIRouter
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_all_baselines

router = APIRouter(prefix="/api", tags=["baselines"])

@router.get("/baselines")
def baselines():
    conn = get_connection(DB_PATH)
    rows = get_all_baselines(conn)
    conn.close()
    return {
        metric: {
            "mean": round(data["mean"], 2),
            "spread": round(data["spread"], 2),
            "status": data["status"],
        }
        for metric, data in rows.items()
    }
