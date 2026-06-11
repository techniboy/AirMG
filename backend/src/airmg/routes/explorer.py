from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

METRIC_CATALOG = [
    {
        "key": "hrv_rmssd",
        "title": "HRV (RMSSD)",
        "category": "Heart",
        "unit": "ms",
        "higher_is_better": True,
    },
    {
        "key": "resting_hr",
        "title": "Resting Heart Rate",
        "category": "Heart",
        "unit": "bpm",
        "higher_is_better": False,
    },
    {
        "key": "recovery",
        "title": "Recovery",
        "category": "Recovery",
        "unit": "%",
        "higher_is_better": True,
    },
    {
        "key": "strain",
        "title": "Strain",
        "category": "Strain",
        "unit": "",
        "higher_is_better": None,
    },
    {
        "key": "sleep_performance",
        "title": "Sleep Performance",
        "category": "Sleep",
        "unit": "%",
        "higher_is_better": True,
    },
    {
        "key": "sleep_minutes",
        "title": "Sleep Duration",
        "category": "Sleep",
        "unit": "min",
        "higher_is_better": True,
    },
    {
        "key": "deep_minutes",
        "title": "Deep Sleep",
        "category": "Sleep",
        "unit": "min",
        "higher_is_better": True,
    },
    {
        "key": "rem_minutes",
        "title": "REM Sleep",
        "category": "Sleep",
        "unit": "min",
        "higher_is_better": True,
    },
    {
        "key": "resp_rate",
        "title": "Respiratory Rate",
        "category": "Health",
        "unit": "rpm",
        "higher_is_better": False,
    },
    {
        "key": "spo2",
        "title": "Blood Oxygen",
        "category": "Health",
        "unit": "%",
        "higher_is_better": True,
    },
    {
        "key": "skin_temp",
        "title": "Skin Temperature",
        "category": "Health",
        "unit": "°C",
        "higher_is_better": None,
    },
    {"key": "steps", "title": "Steps", "category": "Strain", "unit": "", "higher_is_better": True},
    {
        "key": "calories",
        "title": "Calories",
        "category": "Strain",
        "unit": "kcal",
        "higher_is_better": None,
    },
]


@router.get("/explorer")
def explorer():
    return {"metrics": METRIC_CATALOG}
