import tempfile
from pathlib import Path

from airmg.store.db import get_connection, init_db


def test_init_db_creates_tables():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test.db"
        init_db(db_path)
        conn = get_connection(db_path)
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = [t[0] for t in tables]
        for t in [
            "samples",
            "sleep_sessions",
            "workouts",
            "daily_metrics",
            "baselines",
            "journal_entries",
            "steps",
            "sync_state",
            "profile",
        ]:
            assert t in table_names
        conn.close()


def test_init_db_is_idempotent():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test.db"
        init_db(db_path)
        init_db(db_path)
        conn = get_connection(db_path)
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        assert len(tables) >= 9
        conn.close()
