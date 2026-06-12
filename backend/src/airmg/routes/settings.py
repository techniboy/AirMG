from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_profile
from airmg.store.writes import set_profile

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROFILE_KEYS = [
    "age", "sex", "weight_kg", "height_cm", "unit_system", "temperature_unit",
    "hr_max", "sleep_need_hours",
]
NUMERIC_KEYS = {"age": int, "weight_kg": float, "height_cm": float, "hr_max": float, "sleep_need_hours": float}


class ProfileSettings(BaseModel):
    age: int | None = None
    sex: str | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    unit_system: str | None = None
    temperature_unit: str | None = None
    hr_max: float | None = None
    sleep_need_hours: float | None = None


def _read_settings(conn) -> dict:
    out = {}
    for k in PROFILE_KEYS:
        v = get_profile(conn, k)
        if v is not None and k in NUMERIC_KEYS:
            v = NUMERIC_KEYS[k](float(v))
        out[k] = v
    out["unit_system"] = out["unit_system"] or "metric"
    return out


@router.get("")
def get_settings():
    conn = get_connection(DB_PATH)
    settings = _read_settings(conn)
    conn.close()
    return settings


@router.put("")
def update_settings(update: ProfileSettings):
    conn = get_connection(DB_PATH)
    before = (get_profile(conn, "age"), get_profile(conn, "hr_max"))
    for key, value in update.model_dump(exclude_none=True).items():
        set_profile(conn, key, str(value))
    recomputed = 0
    if (get_profile(conn, "age"), get_profile(conn, "hr_max")) != before:
        from airmg.analytics.pipeline import recompute_strain_history

        recomputed = recompute_strain_history(conn)
    settings = _read_settings(conn)
    conn.close()
    return {"status": "ok", "recomputed_days": recomputed, **settings}
