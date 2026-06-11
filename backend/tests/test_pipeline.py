import tempfile
from datetime import date
from pathlib import Path

from airmg.analytics.pipeline import compute_daily_metrics
from airmg.store.db import get_connection, init_db
from airmg.store.reads import get_all_baselines, get_daily_metrics_range
from airmg.store.writes import upsert_samples, upsert_sleep_session


def _setup_db():
    tmp = tempfile.mkdtemp()
    db_path = Path(tmp) / "test.db"
    init_db(db_path)
    return get_connection(db_path)


def test_compute_daily_metrics_basic():
    conn = _setup_db()
    base_ts = 1718000000
    day = date.fromtimestamp(base_ts).isoformat()
    hr_samples = [{"type": "hr", "ts": base_ts + i, "value": 65 + (i % 10)} for i in range(700)]
    hrv_samples = [
        {"type": "hrv", "ts": base_ts + i * 300, "value": 50.0 + (i % 5)} for i in range(20)
    ]
    upsert_samples(conn, hr_samples)
    upsert_samples(conn, hrv_samples)
    upsert_sleep_session(
        conn,
        start_ts=base_ts - 28800,
        end_ts=base_ts - 3600,
        efficiency=0.88,
        resting_hr=55,
        avg_hrv=48.0,
    )
    compute_daily_metrics(conn, day)
    metrics = get_daily_metrics_range(conn, day, day)
    assert len(metrics) == 1
    m = metrics[0]
    assert m["hrv_rmssd"] is not None
    assert m["resting_hr"] is not None
    conn.close()


def test_compute_builds_baselines():
    conn = _setup_db()
    base_ts = 1718000000
    for night in range(5):
        day_ts = base_ts + night * 86400
        day_str = date.fromtimestamp(day_ts).isoformat()
        hrv_samples = [{"type": "hrv", "ts": day_ts + i * 300, "value": 50.0} for i in range(10)]
        upsert_samples(conn, hrv_samples)
        upsert_sleep_session(
            conn,
            start_ts=day_ts - 28800,
            end_ts=day_ts - 3600,
            efficiency=0.85,
            resting_hr=58,
            avg_hrv=50.0,
        )
        compute_daily_metrics(conn, day_str)
    baselines = get_all_baselines(conn)
    assert "hrv" in baselines
    assert baselines["hrv"]["n_valid"] >= 4
    conn.close()
