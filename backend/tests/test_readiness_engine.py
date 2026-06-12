# backend/tests/test_readiness_engine.py
from __future__ import annotations

import tempfile
from datetime import date, timedelta
from pathlib import Path

from airmg.store.db import get_connection, init_db
from airmg.store.writes import upsert_baseline, upsert_daily_metrics, set_profile
from airmg.analytics.readiness import ReadinessEngine


def _db():
    tmp = tempfile.mkdtemp()
    db_path = Path(tmp) / "test.db"
    init_db(db_path)
    return get_connection(db_path)


def _seed_days(conn, n: int, hrv=55.0, rhr=58.0, strain=10.0, sleep_minutes=420):
    """Seed n days ending yesterday with given metrics."""
    today = date.today()
    for i in range(n):
        day = (today - timedelta(days=n - i)).isoformat()
        upsert_daily_metrics(conn, {
            "day": day,
            "hrv_rmssd": hrv,
            "resting_hr": rhr,
            "strain": strain,
            "sleep_minutes": sleep_minutes,
        })


def _seed_baselines(conn, hrv_mean=55.0, hrv_spread=8.0, rhr_mean=58.0, rhr_spread=3.0):
    upsert_baseline(conn, "hrv", mean=hrv_mean, spread=hrv_spread, n_valid=14, status="trusted")
    upsert_baseline(conn, "resting_hr", mean=rhr_mean, spread=rhr_spread, n_valid=14, status="trusted")


def _seed_profile(conn, sleep_need_hours=7.0):
    set_profile(conn, "sleep_need_hours", str(sleep_need_hours))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_insufficient_with_few_days():
    conn = _db()
    _seed_days(conn, 3)
    _seed_baselines(conn)
    _seed_profile(conn)

    result = ReadinessEngine.evaluate(conn)
    assert result.level == "insufficient"
    conn.close()


def test_primed_when_all_good():
    conn = _db()
    # Good HRV: above baseline mean, good RHR: at baseline, moderate strain, good sleep
    _seed_days(conn, 28, hrv=65.0, rhr=58.0, strain=10.0, sleep_minutes=450)
    _seed_baselines(conn, hrv_mean=55.0, hrv_spread=8.0, rhr_mean=60.0, rhr_spread=3.0)
    _seed_profile(conn, sleep_need_hours=7.0)

    result = ReadinessEngine.evaluate(conn)
    assert result.level == "primed"
    conn.close()


def test_rundown_when_bad_signal():
    conn = _db()
    # Very low HRV (z << -1), elevated RHR (+7 bpm), poor sleep
    _seed_days(conn, 28, hrv=25.0, rhr=67.0, strain=10.0, sleep_minutes=240)
    _seed_baselines(conn, hrv_mean=55.0, hrv_spread=8.0, rhr_mean=60.0, rhr_spread=3.0)
    _seed_profile(conn, sleep_need_hours=8.0)

    result = ReadinessEngine.evaluate(conn)
    assert result.level == "rundown"
    conn.close()


def test_result_has_headline_and_summary():
    conn = _db()
    _seed_days(conn, 14, hrv=55.0, rhr=58.0, strain=10.0, sleep_minutes=420)
    _seed_baselines(conn)
    _seed_profile(conn)

    result = ReadinessEngine.evaluate(conn)
    assert result.headline and len(result.headline) > 0
    assert result.summary and len(result.summary) > 0
    conn.close()


def test_acwr_calculation():
    conn = _db()
    today = date.today()
    # Days 28..8 ago: low strain (5)
    for i in range(21, 0, -1):
        day = (today - timedelta(days=i)).isoformat()
        upsert_daily_metrics(conn, {
            "day": day,
            "hrv_rmssd": 55.0,
            "resting_hr": 58.0,
            "strain": 5.0,
            "sleep_minutes": 420,
        })
    # Last 7 days: high strain (20)
    for i in range(7, 0, -1):
        day = (today - timedelta(days=i)).isoformat()
        upsert_daily_metrics(conn, {
            "day": day,
            "hrv_rmssd": 55.0,
            "resting_hr": 58.0,
            "strain": 20.0,
            "sleep_minutes": 420,
        })
    _seed_baselines(conn)
    _seed_profile(conn)

    result = ReadinessEngine.evaluate(conn)

    # ACWR = sum(last 7d strain) / (sum(last 28d strain) / 4)
    # last 7d strain = 7 * 20 = 140
    # last 28d strain = 21 * 5 + 7 * 20 = 105 + 140 = 245
    # chronic avg per 7d = 245 / 4 = 61.25
    # ACWR = 140 / 61.25 ≈ 2.29
    assert result.acwr is not None
    assert result.acwr > 1.5

    load_signal = next((s for s in result.signals if s.key == "load"), None)
    assert load_signal is not None
    assert load_signal.flag == "bad"
    conn.close()
