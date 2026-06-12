from datetime import date, timedelta

from airmg.analytics.health_age import compute_health_age
from airmg.store.db import get_connection, init_db
from airmg.store.writes import set_profile, upsert_daily_metrics


def _db(tmp_path):
    p = tmp_path / "t.db"
    init_db(p)
    return get_connection(p)


def test_needs_profile(tmp_path):
    conn = _db(tmp_path)
    assert compute_health_age(conn)["status"] == "needs_profile"


def test_optimal_habits_score_younger(tmp_path):
    conn = _db(tmp_path)
    set_profile(conn, "age", "40")
    for i in range(30):
        day = (date.today() - timedelta(days=i)).isoformat()
        upsert_daily_metrics(
            conn,
            {"day": day, "sleep_minutes": 480, "steps": 10000, "resting_hr": 52.0},
        )
    result = compute_health_age(conn)
    assert result["status"] == "ok"
    # Good sleep, steps, RHR outweigh missing zone/strength data
    assert result["health_age"] < 40 + 2
    assert any(m["key"] == "rhr" and m["delta_years"] < 0 for m in result["metrics"])


def test_poor_habits_score_older(tmp_path):
    conn = _db(tmp_path)
    set_profile(conn, "age", "40")
    for i in range(30):
        day = (date.today() - timedelta(days=i)).isoformat()
        upsert_daily_metrics(
            conn,
            {"day": day, "sleep_minutes": 300, "steps": 2000, "resting_hr": 75.0},
        )
    result = compute_health_age(conn)
    assert result["status"] == "ok"
    assert result["health_age"] > 40
