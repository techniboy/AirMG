from __future__ import annotations

import csv
import io
import sqlite3

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from airmg.store.db import get_db
from airmg.store.reads import get_daily_metrics_range

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/export/csv")
def export_csv(
    start: str = Query(..., description="yyyy-MM-dd"),
    end: str = Query(..., description="yyyy-MM-dd"),
    conn: sqlite3.Connection = Depends(get_db),
):
    days = get_daily_metrics_range(conn, start, end)
    if not days:
        return StreamingResponse(io.StringIO(""), media_type="text/csv")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=days[0].keys())
    writer.writeheader()
    writer.writerows(days)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=airmg-{start}-{end}.csv"},
    )
