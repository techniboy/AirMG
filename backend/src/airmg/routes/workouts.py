from __future__ import annotations

import sqlite3
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query

from airmg.analytics.zones import build_zones, time_in_zones
from airmg.store.db import get_db
from airmg.store.reads import get_profile, get_samples_range

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.get("")
def list_workouts(
    limit: int = Query(500, le=1000),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_db),
):
    rows = conn.execute(
        "SELECT * FROM workouts ORDER BY start_ts DESC LIMIT ? OFFSET ?", (limit, offset)
    ).fetchall()
    return {"workouts": [dict(r) for r in rows]}


@router.get("/summary")
def workouts_summary(
    days: int = Query(30, ge=1, le=9999), conn: sqlite3.Connection = Depends(get_db)
):
    if days >= 9999:
        cutoff_ts = 0
    else:
        cutoff = date.today() - timedelta(days=days)
        cutoff_ts = int(datetime.combine(cutoff, datetime.min.time()).timestamp())

    rows = conn.execute(
        "SELECT * FROM workouts WHERE start_ts >= ? ORDER BY start_ts DESC",
        (cutoff_ts,),
    ).fetchall()
    workouts = [dict(r) for r in rows]

    if not workouts:
        return {
            "count": 0,
            "total_minutes": 0,
            "total_calories": 0,
            "sport_breakdown": [],
            "hr_zones": {},
        }

    total_min = 0
    total_cal = 0.0
    sport_data: dict[str, dict] = defaultdict(
        lambda: {
            "count": 0,
            "minutes": 0,
            "strain_sum": 0.0,
            "strain_n": 0,
            "hr_sum": 0,
            "hr_n": 0,
        }
    )

    age_str = get_profile(conn, "age")
    hr_max_str = get_profile(conn, "hr_max")
    zone_set = build_zones(
        age=int(age_str) if age_str else None,
        manual_max_hr=float(hr_max_str) if hr_max_str else None,
    )
    total_zones: dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    for w in workouts:
        dur = max(0, w["end_ts"] - w["start_ts"]) // 60
        total_min += dur
        if w.get("calories"):
            total_cal += w["calories"]

        sport = w.get("type") or "Activity"
        sd = sport_data[sport]
        sd["count"] += 1
        sd["minutes"] += dur
        if w.get("strain") is not None:
            sd["strain_sum"] += w["strain"]
            sd["strain_n"] += 1
        if w.get("avg_hr") is not None:
            sd["hr_sum"] += w["avg_hr"]
            sd["hr_n"] += 1

        hr_samples = get_samples_range(conn, "hr", w["start_ts"], w["end_ts"])
        if hr_samples:
            wz = time_in_zones(zone_set, hr_samples)
            for z, count in wz.items():
                total_zones[z] += count

    breakdown = []
    for sport, sd in sorted(sport_data.items(), key=lambda x: x[1]["count"], reverse=True):
        breakdown.append(
            {
                "type": sport,
                "count": sd["count"],
                "minutes": sd["minutes"],
                "avg_strain": round(sd["strain_sum"] / sd["strain_n"], 1) if sd["strain_n"] else 0,
                "avg_hr": round(sd["hr_sum"] / sd["hr_n"]) if sd["hr_n"] else 0,
            }
        )

    return {
        "count": len(workouts),
        "total_minutes": total_min,
        "total_calories": round(total_cal),
        "sport_breakdown": breakdown,
        "hr_zones": total_zones,
    }


@router.get("/{workout_id}")
def workout_detail(workout_id: int, conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute("SELECT * FROM workouts WHERE id = ?", (workout_id,)).fetchone()
    if row is None:
        return {"status": "not_found"}
    return dict(row)
