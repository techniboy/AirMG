from __future__ import annotations
import csv
import io
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range

router = APIRouter(prefix="/api", tags=["export"])

@router.get("/export/csv")
def export_csv(
    start: str = Query(..., description="yyyy-MM-dd"),
    end: str = Query(..., description="yyyy-MM-dd"),
):
    conn = get_connection(DB_PATH)
    days = get_daily_metrics_range(conn, start, end)
    conn.close()
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
