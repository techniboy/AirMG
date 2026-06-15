from __future__ import annotations

import sqlite3
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query

from airmg.analytics import behaviors
from airmg.analytics.correlation import align_by_day, lagged, pearson
from airmg.journal.catalog import JOURNAL_QUESTIONS
from airmg.store.db import get_db
from airmg.store.reads import get_daily_metrics_range, get_journal_entries_range

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("")
def insights(conn: sqlite3.Connection = Depends(get_db)):
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=89)).isoformat()
    days = get_daily_metrics_range(conn, start, end)
    correlations = []
    if len(days) >= 10:
        metric_pairs = [
            ("strain", "recovery", 1),
            ("hrv_rmssd", "recovery", 0),
            ("sleep_performance", "recovery", 0),
        ]
        for x_key, y_key, lag in metric_pairs:
            x = {d["day"]: d[x_key] for d in days if d.get(x_key) is not None}
            y = {d["day"]: d[y_key] for d in days if d.get(y_key) is not None}
            if lag > 0:
                result = lagged(x, y, lag_days=lag)
            else:
                pairs = align_by_day(x, y)
                result = pearson(pairs)
            if result:
                correlations.append(
                    {
                        "x": x_key,
                        "y": y_key,
                        "lag": lag,
                        "r": round(result.r, 3),
                        "n": result.n,
                        "p": round(result.p_approx, 4),
                    }
                )
    return {"correlations": correlations}


OUTCOME_MAP: dict[str, tuple[str, str, bool]] = {
    "recovery": ("recovery", "Recovery", True),
    "hrv": ("hrv_rmssd", "HRV", True),
    "sleep_performance": ("sleep_performance", "Sleep Performance", True),
    "resting_hr": ("resting_hr", "Resting HR", False),
}


@router.get("/behaviours")
def behaviours(
    outcome: str = Query(
        default="recovery", pattern="^(recovery|hrv|sleep_performance|resting_hr)$"
    ),
    conn: sqlite3.Connection = Depends(get_db),
):
    metric_key, outcome_name, higher_is_better = OUTCOME_MAP[outcome]

    end = date.today().isoformat()
    start = (date.today() - timedelta(days=89)).isoformat()

    daily_rows = get_daily_metrics_range(conn, start, end)
    journal_rows = get_journal_entries_range(conn, start, end)

    # Build metrics dict: day → metric value
    metrics: dict[str, float] = {
        row["day"]: row[metric_key] for row in daily_rows if row.get(metric_key) is not None
    }

    # Build questions dict from JOURNAL_QUESTIONS catalog
    questions: dict[str, dict] = {
        q["id"]: {"question": q["question"], "category": q["category"]} for q in JOURNAL_QUESTIONS
    }

    # Build journal dict: question_key → {day → bool}
    journal: dict[str, dict[str, bool]] = {}
    for row in journal_rows:
        qk = row["question_key"]
        if qk not in journal:
            journal[qk] = {}
        answer = row.get("answer", "")
        journal[qk][row["day"]] = str(answer).lower() in ("true", "1", "yes")

    effects = behaviors.analyze(journal, metrics, questions, outcome_name, higher_is_better)
    return {"effects": [e.to_dict() for e in effects]}
