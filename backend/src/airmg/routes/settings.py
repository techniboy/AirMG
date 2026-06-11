from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_profile
from airmg.store.writes import set_profile

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROFILE_KEYS = ["age", "sex", "weight_kg", "height_cm", "unit_system", "temperature_unit"]


class ProfileUpdate(BaseModel):
    key: str
    value: str


@router.get("")
def get_settings():
    conn = get_connection(DB_PATH)
    settings = {k: get_profile(conn, k) for k in PROFILE_KEYS}
    conn.close()
    return {"settings": settings}


@router.put("")
def update_setting(update: ProfileUpdate):
    conn = get_connection(DB_PATH)
    set_profile(conn, update.key, update.value)
    conn.close()
    return {"status": "ok"}
