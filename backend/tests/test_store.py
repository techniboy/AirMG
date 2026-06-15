import tempfile
from pathlib import Path

from airmg.store.db import get_connection, init_db
from airmg.store.reads import (
    get_baseline,
    get_daily_metrics_range,
    get_journal_entries,
    get_samples_range,
    get_today_metrics,
)
from airmg.store.writes import (
    upsert_baseline,
    upsert_daily_metrics,
    upsert_journal_entry,
    upsert_samples,
)


def _db():
    tmp = tempfile.mkdtemp()
    db_path = Path(tmp) / "test.db"
    init_db(db_path)
    return get_connection(db_path)


def test_upsert_and_read_samples():
    conn = _db()
    samples = [
        {"type": "hr", "ts": 1000, "value": 72.0},
        {"type": "hr", "ts": 1001, "value": 74.0},
        {"type": "hrv", "ts": 1000, "value": 45.0},
    ]
    upsert_samples(conn, samples)
    result = get_samples_range(conn, "hr", 999, 1002)
    assert len(result) == 2
    assert result[0]["value"] == 72.0
    conn.close()


def test_upsert_and_read_daily_metrics():
    conn = _db()
    upsert_daily_metrics(
        conn,
        {
            "day": "2026-06-10",
            "recovery": 72.5,
            "strain": 14.3,
            "hrv_rmssd": 48.0,
            "resting_hr": 55.0,
        },
    )
    result = get_daily_metrics_range(conn, "2026-06-09", "2026-06-11")
    assert len(result) == 1
    assert result[0]["recovery"] == 72.5
    conn.close()


def test_upsert_and_read_baseline():
    conn = _db()
    upsert_baseline(
        conn, "hrv", mean=50.0, spread=8.0, n_valid=10, nights_since_update=0, status="provisional"
    )
    b = get_baseline(conn, "hrv")
    assert b is not None
    assert b["mean"] == 50.0
    assert b["status"] == "provisional"
    conn.close()


def test_upsert_and_read_journal():
    conn = _db()
    upsert_journal_entry(
        conn, "2026-06-10", "alcohol", "Did you drink any alcohol?", True, 1718000000
    )
    entries = get_journal_entries(conn, "2026-06-10")
    assert len(entries) == 1
    assert entries[0]["answer"] is True
    assert entries[0]["question_id"] == "alcohol"
    assert entries[0]["question"] == "Did you drink any alcohol?"
    conn.close()


def test_today_metrics_returns_none_when_empty():
    conn = _db()
    result = get_today_metrics(conn)
    assert result is None
    conn.close()
