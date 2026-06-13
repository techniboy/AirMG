import sqlite3
from pathlib import Path

_SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection(db_path)
    schema = _SCHEMA_PATH.read_text()
    conn.executescript(schema)
    _migrate(conn)
    conn.close()


def _migrate(conn: sqlite3.Connection) -> None:
    # baselines.last_day: forward-only fold marker. Pre-existing DBs lack the
    # column; seed it to the newest computed day so already-folded history is
    # not re-folded on the next sync.
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(baselines)")}
    if "last_day" not in cols:
        conn.execute("ALTER TABLE baselines ADD COLUMN last_day TEXT")
        conn.execute(
            "UPDATE baselines SET last_day = (SELECT MAX(day) FROM daily_metrics)"
            " WHERE last_day IS NULL"
        )
        conn.commit()
