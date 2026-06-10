# AirMG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill guidelines:** Before writing code, invoke the relevant skill:
> - Python files → invoke `modern-python` (project setup), `ruff` (lint/format), `fastapi-python` (routes)
> - SQLite schema → invoke `sqlite-database-expert`
> - React/TSX → invoke `tailwind-v4-shadcn`, `vercel-plugin:shadcn`, `vercel-plugin:react-best-practices`
> - UI pages → invoke `frontend-design:frontend-design`
> - Tests → invoke `superpowers:test-driven-development`
> - Debugging → invoke `superpowers:systematic-debugging`
> - Completion → invoke `superpowers:verification-before-completion`

**Goal:** Build AirMG — a local-first health dashboard that pulls Fitbit Air data via Google Health API, runs NOOP-derived analytics (recovery, strain, sleep), and serves a dark-themed React UI.

**Architecture:** Python FastAPI backend on localhost:8000 handles Google OAuth, syncs health data, stores in SQLite, runs analytics engines ported from NOOP's Swift. Vite+React+Tailwind frontend on localhost:5173 is a thin visualization layer hitting the API.

**Tech Stack:** Python 3.13+ (uv, ruff, FastAPI, uvicorn), SQLite, React 19, TypeScript, Vite, Tailwind v4, shadcn/ui, Biome, recharts

**Reference codebase:** `noop/` directory contains all analytics engines in Swift — port to Python faithfully.

---

## Phase 1: Project Scaffolding

### Task 1: Python Backend Scaffold

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/src/airmg/__init__.py`
- Create: `backend/src/airmg/main.py`
- Create: `backend/src/airmg/config.py`

- [ ] **Step 1: Initialize uv project**

```bash
cd /Users/suryaprasad/projects/air_mg
mkdir -p backend/src/airmg
cd backend
uv init --name airmg --lib
```

- [ ] **Step 2: Configure pyproject.toml**

Replace the generated `pyproject.toml` with:

```toml
[project]
name = "airmg"
version = "0.1.0"
description = "Local-first health dashboard for Fitbit Air"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "httpx>=0.28",
    "google-auth>=2.38",
    "google-auth-oauthlib>=1.2",
]

[project.scripts]
airmg = "airmg.main:run"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py313"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "RUF"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 3: Create config.py**

```python
# backend/src/airmg/config.py
from pathlib import Path

DATA_DIR = Path.home() / ".airmg"
DB_PATH = DATA_DIR / "airmg.db"
TOKENS_PATH = DATA_DIR / "tokens.json"
CLIENT_SECRETS_PATH = DATA_DIR / "client_secret.json"

GOOGLE_HEALTH_BASE = "https://health.googleapis.com/v4"
GOOGLE_HEALTH_SCOPES = [
    "https://www.googleapis.com/auth/health.body.read",
    "https://www.googleapis.com/auth/health.heart_rate.read",
    "https://www.googleapis.com/auth/health.sleep.read",
    "https://www.googleapis.com/auth/health.activity.read",
    "https://www.googleapis.com/auth/health.blood_oxygen.read",
    "https://www.googleapis.com/auth/health.respiratory_rate.read",
    "https://www.googleapis.com/auth/health.body_temperature.read",
]

BACKEND_PORT = 8000
FRONTEND_ORIGIN = "http://localhost:5173"
OAUTH_REDIRECT_URI = f"http://localhost:{BACKEND_PORT}/auth/callback"


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 4: Create main.py**

```python
# backend/src/airmg/main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from airmg.config import BACKEND_PORT, FRONTEND_ORIGIN, ensure_dirs

app = FastAPI(title="AirMG", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


def run():
    ensure_dirs()
    uvicorn.run("airmg.main:app", host="127.0.0.1", port=BACKEND_PORT, reload=True)
```

- [ ] **Step 5: Create __init__.py**

```python
# backend/src/airmg/__init__.py
```

- [ ] **Step 6: Install dependencies and verify**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv sync
uv run airmg &
sleep 2
curl http://localhost:8000/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: scaffold Python backend with FastAPI + uv"
```

---

### Task 2: SQLite Database + Schema

**Files:**
- Create: `backend/src/airmg/store/db.py`
- Create: `backend/src/airmg/store/schema.sql`
- Create: `backend/tests/test_db.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_db.py
import sqlite3
import tempfile
from pathlib import Path

from airmg.store.db import init_db, get_connection


def test_init_db_creates_tables():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test.db"
        init_db(db_path)
        conn = get_connection(db_path)
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = [t[0] for t in tables]
        assert "samples" in table_names
        assert "sleep_sessions" in table_names
        assert "workouts" in table_names
        assert "daily_metrics" in table_names
        assert "baselines" in table_names
        assert "journal_entries" in table_names
        assert "steps" in table_names
        assert "sync_state" in table_names
        assert "profile" in table_names
        conn.close()


def test_init_db_is_idempotent():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test.db"
        init_db(db_path)
        init_db(db_path)  # second call should not error
        conn = get_connection(db_path)
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        assert len(tables) >= 9
        conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_db.py -v
```
Expected: FAIL with `ModuleNotFoundError: No module named 'airmg.store'`

- [ ] **Step 3: Create schema.sql**

```sql
-- backend/src/airmg/store/schema.sql

CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ts INTEGER NOT NULL,
    value REAL NOT NULL,
    source TEXT DEFAULT 'google-health',
    UNIQUE(type, ts)
);
CREATE INDEX IF NOT EXISTS idx_samples_type_ts ON samples(type, ts);

CREATE TABLE IF NOT EXISTS sleep_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    efficiency REAL,
    stages_json TEXT,
    resting_hr INTEGER,
    avg_hrv REAL,
    source TEXT DEFAULT 'google-health',
    UNIQUE(start_ts, end_ts)
);

CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    type TEXT,
    calories REAL,
    avg_hr INTEGER,
    max_hr INTEGER,
    strain REAL,
    source TEXT DEFAULT 'google-health',
    UNIQUE(start_ts, end_ts)
);

CREATE TABLE IF NOT EXISTS daily_metrics (
    day TEXT PRIMARY KEY,
    recovery REAL,
    strain REAL,
    sleep_performance REAL,
    hrv_rmssd REAL,
    resting_hr REAL,
    resp_rate REAL,
    spo2 REAL,
    skin_temp REAL,
    steps INTEGER,
    calories REAL,
    sleep_minutes INTEGER,
    deep_minutes INTEGER,
    rem_minutes INTEGER,
    light_minutes INTEGER,
    wake_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS baselines (
    metric TEXT PRIMARY KEY,
    mean REAL NOT NULL,
    spread REAL NOT NULL,
    n_valid INTEGER NOT NULL,
    nights_since_update INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'calibrating',
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    question_key TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at INTEGER,
    UNIQUE(day, question_key)
);

CREATE TABLE IF NOT EXISTS steps (
    day TEXT PRIMARY KEY,
    total INTEGER NOT NULL,
    source TEXT DEFAULT 'google-health'
);

CREATE TABLE IF NOT EXISTS sync_state (
    data_type TEXT PRIMARY KEY,
    last_synced_ts INTEGER,
    last_token TEXT
);

CREATE TABLE IF NOT EXISTS profile (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

- [ ] **Step 4: Create db.py**

```python
# backend/src/airmg/store/db.py
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
    conn.close()
```

Create `__init__.py`:

```python
# backend/src/airmg/store/__init__.py
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_db.py -v
```
Expected: 2 PASSED

- [ ] **Step 6: Wire DB init into FastAPI startup**

Add to `backend/src/airmg/main.py`:

```python
from contextlib import asynccontextmanager
from airmg.config import DB_PATH, ensure_dirs
from airmg.store.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    init_db(DB_PATH)
    yield

# Update the FastAPI constructor:
app = FastAPI(title="AirMG", version="0.1.0", lifespan=lifespan)
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/airmg/store/ backend/tests/test_db.py backend/src/airmg/main.py
git commit -m "feat: add SQLite schema and database initialization"
```

---

### Task 3: Store Read/Write Functions

**Files:**
- Create: `backend/src/airmg/store/writes.py`
- Create: `backend/src/airmg/store/reads.py`
- Create: `backend/tests/test_store.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_store.py
import tempfile
from pathlib import Path

from airmg.store.db import init_db, get_connection
from airmg.store.writes import (
    upsert_samples,
    upsert_sleep_session,
    upsert_workout,
    upsert_daily_metrics,
    upsert_baseline,
    upsert_journal_entry,
    upsert_steps,
    set_sync_state,
    set_profile,
)
from airmg.store.reads import (
    get_samples_range,
    get_sleep_sessions_range,
    get_workouts_range,
    get_daily_metrics_range,
    get_baseline,
    get_all_baselines,
    get_journal_entries,
    get_steps_range,
    get_sync_state,
    get_profile,
    get_today_metrics,
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
    upsert_daily_metrics(conn, {
        "day": "2026-06-10",
        "recovery": 72.5,
        "strain": 14.3,
        "hrv_rmssd": 48.0,
        "resting_hr": 55.0,
    })
    result = get_daily_metrics_range(conn, "2026-06-09", "2026-06-11")
    assert len(result) == 1
    assert result[0]["recovery"] == 72.5
    conn.close()


def test_upsert_and_read_baseline():
    conn = _db()
    upsert_baseline(conn, "hrv", mean=50.0, spread=8.0, n_valid=10,
                    nights_since_update=0, status="provisional")
    b = get_baseline(conn, "hrv")
    assert b is not None
    assert b["mean"] == 50.0
    assert b["status"] == "provisional"
    conn.close()


def test_upsert_and_read_journal():
    conn = _db()
    upsert_journal_entry(conn, "2026-06-10", "Did you drink any alcohol?", "yes", 1718000000)
    entries = get_journal_entries(conn, "2026-06-10")
    assert len(entries) == 1
    assert entries[0]["answer"] == "yes"
    conn.close()


def test_today_metrics_returns_none_when_empty():
    conn = _db()
    result = get_today_metrics(conn)
    assert result is None
    conn.close()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_store.py -v
```
Expected: FAIL — modules don't exist

- [ ] **Step 3: Create writes.py**

```python
# backend/src/airmg/store/writes.py
from __future__ import annotations

import sqlite3
import time
from typing import Any


def upsert_samples(conn: sqlite3.Connection, samples: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO samples (type, ts, value, source)
        VALUES (:type, :ts, :value, :source)
        ON CONFLICT(type, ts) DO UPDATE SET value = excluded.value
    """
    count = 0
    for s in samples:
        s.setdefault("source", "google-health")
        conn.execute(sql, s)
        count += 1
    conn.commit()
    return count


def upsert_sleep_session(
    conn: sqlite3.Connection,
    start_ts: int,
    end_ts: int,
    efficiency: float | None = None,
    stages_json: str | None = None,
    resting_hr: int | None = None,
    avg_hrv: float | None = None,
    source: str = "google-health",
) -> None:
    conn.execute(
        """INSERT INTO sleep_sessions (start_ts, end_ts, efficiency, stages_json, resting_hr, avg_hrv, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(start_ts, end_ts) DO UPDATE SET
             efficiency=excluded.efficiency, stages_json=excluded.stages_json,
             resting_hr=excluded.resting_hr, avg_hrv=excluded.avg_hrv""",
        (start_ts, end_ts, efficiency, stages_json, resting_hr, avg_hrv, source),
    )
    conn.commit()


def upsert_workout(
    conn: sqlite3.Connection,
    start_ts: int,
    end_ts: int,
    workout_type: str | None = None,
    calories: float | None = None,
    avg_hr: int | None = None,
    max_hr: int | None = None,
    strain: float | None = None,
    source: str = "google-health",
) -> None:
    conn.execute(
        """INSERT INTO workouts (start_ts, end_ts, type, calories, avg_hr, max_hr, strain, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(start_ts, end_ts) DO UPDATE SET
             type=excluded.type, calories=excluded.calories, avg_hr=excluded.avg_hr,
             max_hr=excluded.max_hr, strain=excluded.strain""",
        (start_ts, end_ts, workout_type, calories, avg_hr, max_hr, strain, source),
    )
    conn.commit()


def upsert_daily_metrics(conn: sqlite3.Connection, data: dict[str, Any]) -> None:
    cols = [
        "day", "recovery", "strain", "sleep_performance", "hrv_rmssd", "resting_hr",
        "resp_rate", "spo2", "skin_temp", "steps", "calories", "sleep_minutes",
        "deep_minutes", "rem_minutes", "light_minutes", "wake_minutes",
    ]
    present = {k: data.get(k) for k in cols if k in data}
    keys = list(present.keys())
    placeholders = ", ".join(f":{k}" for k in keys)
    updates = ", ".join(f"{k}=excluded.{k}" for k in keys if k != "day")
    conn.execute(
        f"INSERT INTO daily_metrics ({', '.join(keys)}) VALUES ({placeholders}) "
        f"ON CONFLICT(day) DO UPDATE SET {updates}",
        present,
    )
    conn.commit()


def upsert_baseline(
    conn: sqlite3.Connection,
    metric: str,
    mean: float,
    spread: float,
    n_valid: int,
    nights_since_update: int = 0,
    status: str = "calibrating",
) -> None:
    conn.execute(
        """INSERT INTO baselines (metric, mean, spread, n_valid, nights_since_update, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(metric) DO UPDATE SET
             mean=excluded.mean, spread=excluded.spread, n_valid=excluded.n_valid,
             nights_since_update=excluded.nights_since_update, status=excluded.status,
             updated_at=excluded.updated_at""",
        (metric, mean, spread, n_valid, nights_since_update, status, int(time.time())),
    )
    conn.commit()


def upsert_journal_entry(
    conn: sqlite3.Connection,
    day: str,
    question_key: str,
    answer: str,
    created_at: int | None = None,
) -> None:
    conn.execute(
        """INSERT INTO journal_entries (day, question_key, answer, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(day, question_key) DO UPDATE SET answer=excluded.answer""",
        (day, question_key, answer, created_at or int(time.time())),
    )
    conn.commit()


def upsert_steps(conn: sqlite3.Connection, day: str, total: int, source: str = "google-health") -> None:
    conn.execute(
        """INSERT INTO steps (day, total, source) VALUES (?, ?, ?)
           ON CONFLICT(day) DO UPDATE SET total=excluded.total""",
        (day, total, source),
    )
    conn.commit()


def set_sync_state(conn: sqlite3.Connection, data_type: str, last_synced_ts: int, last_token: str | None = None) -> None:
    conn.execute(
        """INSERT INTO sync_state (data_type, last_synced_ts, last_token)
           VALUES (?, ?, ?)
           ON CONFLICT(data_type) DO UPDATE SET
             last_synced_ts=excluded.last_synced_ts, last_token=excluded.last_token""",
        (data_type, last_synced_ts, last_token),
    )
    conn.commit()


def set_profile(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()
```

- [ ] **Step 4: Create reads.py**

```python
# backend/src/airmg/store/reads.py
from __future__ import annotations

import sqlite3
from datetime import date


def get_samples_range(
    conn: sqlite3.Connection, sample_type: str, start_ts: int, end_ts: int
) -> list[dict]:
    rows = conn.execute(
        "SELECT type, ts, value FROM samples WHERE type = ? AND ts >= ? AND ts <= ? ORDER BY ts",
        (sample_type, start_ts, end_ts),
    ).fetchall()
    return [dict(r) for r in rows]


def get_sleep_sessions_range(
    conn: sqlite3.Connection, start_ts: int, end_ts: int
) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM sleep_sessions WHERE start_ts >= ? AND end_ts <= ? ORDER BY start_ts",
        (start_ts, end_ts),
    ).fetchall()
    return [dict(r) for r in rows]


def get_workouts_range(
    conn: sqlite3.Connection, start_ts: int, end_ts: int
) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM workouts WHERE start_ts >= ? AND end_ts <= ? ORDER BY start_ts",
        (start_ts, end_ts),
    ).fetchall()
    return [dict(r) for r in rows]


def get_daily_metrics_range(
    conn: sqlite3.Connection, start_day: str, end_day: str
) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM daily_metrics WHERE day >= ? AND day <= ? ORDER BY day",
        (start_day, end_day),
    ).fetchall()
    return [dict(r) for r in rows]


def get_today_metrics(conn: sqlite3.Connection) -> dict | None:
    today = date.today().isoformat()
    row = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (today,)).fetchone()
    return dict(row) if row else None


def get_baseline(conn: sqlite3.Connection, metric: str) -> dict | None:
    row = conn.execute("SELECT * FROM baselines WHERE metric = ?", (metric,)).fetchone()
    return dict(row) if row else None


def get_all_baselines(conn: sqlite3.Connection) -> dict[str, dict]:
    rows = conn.execute("SELECT * FROM baselines").fetchall()
    return {r["metric"]: dict(r) for r in rows}


def get_journal_entries(conn: sqlite3.Connection, day: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM journal_entries WHERE day = ? ORDER BY question_key", (day,)
    ).fetchall()
    return [dict(r) for r in rows]


def get_steps_range(conn: sqlite3.Connection, start_day: str, end_day: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM steps WHERE day >= ? AND day <= ? ORDER BY day",
        (start_day, end_day),
    ).fetchall()
    return [dict(r) for r in rows]


def get_sync_state(conn: sqlite3.Connection, data_type: str) -> dict | None:
    row = conn.execute("SELECT * FROM sync_state WHERE data_type = ?", (data_type,)).fetchone()
    return dict(row) if row else None


def get_profile(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM profile WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_store.py -v
```
Expected: 5 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/airmg/store/writes.py backend/src/airmg/store/reads.py backend/tests/test_store.py
git commit -m "feat: add SQLite read/write functions"
```

---

## Phase 2: Analytics Engines (Port from NOOP Swift)

### Task 4: Baselines Engine

**Files:**
- Create: `backend/src/airmg/analytics/__init__.py`
- Create: `backend/src/airmg/analytics/baselines.py`
- Create: `backend/tests/test_baselines.py`

**Reference:** `noop/Packages/StrandAnalytics/Sources/StrandAnalytics/Baselines.swift`
**Reference tests:** `noop/Packages/StrandAnalytics/Tests/StrandAnalyticsTests/BaselinesTests.swift`

- [ ] **Step 1: Read NOOP's BaselinesTests.swift for test values**

```bash
cat noop/Packages/StrandAnalytics/Tests/StrandAnalyticsTests/BaselinesTests.swift
```

Use the exact test values from the Swift tests as oracle values for the Python port.

- [ ] **Step 2: Write failing tests**

```python
# backend/tests/test_baselines.py
from airmg.analytics.baselines import (
    MetricCfg,
    BaselineState,
    BaselineStatus,
    Baselines,
)


HRV_CFG = MetricCfg(min_val=5.0, max_val=250.0, floor_spread=5.0, half_life_b=14.0, half_life_s=21.0)


def test_first_night_seeds_baseline():
    state = Baselines.update(None, 50.0, HRV_CFG)
    assert state.baseline == 50.0
    assert state.spread == 5.0
    assert state.n_valid == 1
    assert state.status == BaselineStatus.CALIBRATING


def test_missing_night_skips_and_holds():
    state = Baselines.update(None, 50.0, HRV_CFG)
    state2 = Baselines.update(state, None, HRV_CFG)
    assert state2.baseline == 50.0
    assert state2.n_valid == 1
    assert state2.nights_since_update == 1


def test_out_of_range_rejected():
    state = Baselines.update(None, 50.0, HRV_CFG)
    state2 = Baselines.update(state, 300.0, HRV_CFG)  # above max_val
    assert state2.n_valid == 1  # not incremented


def test_becomes_provisional_at_seed():
    state = None
    for i in range(4):
        state = Baselines.update(state, 50.0 + i, HRV_CFG)
    assert state.status == BaselineStatus.PROVISIONAL
    assert state.n_valid == 4


def test_becomes_trusted_at_14():
    state = None
    for i in range(14):
        state = Baselines.update(state, 50.0 + (i % 5), HRV_CFG)
    assert state.status == BaselineStatus.TRUSTED
    assert state.n_valid == 14


def test_hard_outlier_rejected_after_seed():
    state = None
    for i in range(5):
        state = Baselines.update(state, 50.0, HRV_CFG)
    spread = state.spread
    outlier = state.baseline + 6 * spread  # > 5 * spread
    state2 = Baselines.update(state, outlier, HRV_CFG)
    assert state2.n_valid == state.n_valid  # not folded


def test_winsorization_clamps():
    state = None
    for i in range(5):
        state = Baselines.update(state, 50.0, HRV_CFG)
    before = state.baseline
    clamped_val = state.baseline + 2.5 * state.spread  # within 3x, will be Winsorized
    state2 = Baselines.update(state, clamped_val, HRV_CFG)
    assert state2.baseline > before
    assert state2.n_valid == state.n_valid + 1


def test_lambda_half_life():
    lam = Baselines.lambda_half_life(14.0)
    # After 14 applications of (1 - lam), weight should be ~0.5
    remaining = (1 - lam) ** 14
    assert abs(remaining - 0.5) < 0.001
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_baselines.py -v
```

- [ ] **Step 4: Implement baselines.py**

```python
# backend/src/airmg/analytics/baselines.py
from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum


class BaselineStatus(StrEnum):
    CALIBRATING = "calibrating"
    PROVISIONAL = "provisional"
    TRUSTED = "trusted"
    STALE = "stale"


@dataclass(frozen=True, slots=True)
class MetricCfg:
    min_val: float
    max_val: float
    floor_spread: float
    half_life_b: float
    half_life_s: float


@dataclass(frozen=True, slots=True)
class BaselineState:
    baseline: float
    spread: float
    n_valid: int
    nights_since_update: int
    status: BaselineStatus

    @property
    def usable(self) -> bool:
        return self.status in (BaselineStatus.PROVISIONAL, BaselineStatus.TRUSTED)


class Baselines:
    WINSOR_K = 3.0
    HARD_OUTLIER_K = 5.0
    MIN_NIGHTS_SEED = 4
    MIN_NIGHTS_TRUST = 14
    STALE_DAYS = 14

    HRV_CFG = MetricCfg(min_val=5.0, max_val=250.0, floor_spread=5.0, half_life_b=14.0, half_life_s=21.0)
    RHR_CFG = MetricCfg(min_val=30.0, max_val=120.0, floor_spread=2.0, half_life_b=14.0, half_life_s=21.0)
    RESP_CFG = MetricCfg(min_val=4.0, max_val=40.0, floor_spread=0.5, half_life_b=14.0, half_life_s=21.0)

    @staticmethod
    def lambda_half_life(half_life: float) -> float:
        return 1.0 - math.pow(0.5, 1.0 / half_life)

    @staticmethod
    def _compute_status(n_valid: int, nights_since_update: int) -> BaselineStatus:
        if nights_since_update > Baselines.STALE_DAYS and n_valid >= Baselines.MIN_NIGHTS_SEED:
            return BaselineStatus.STALE
        if n_valid < Baselines.MIN_NIGHTS_SEED:
            return BaselineStatus.CALIBRATING
        if n_valid < Baselines.MIN_NIGHTS_TRUST:
            return BaselineStatus.PROVISIONAL
        return BaselineStatus.TRUSTED

    @staticmethod
    def update(state: BaselineState | None, value: float | None, cfg: MetricCfg) -> BaselineState:
        lb = Baselines.lambda_half_life(cfg.half_life_b)
        ls = Baselines.lambda_half_life(cfg.half_life_s)

        if state is None:
            if value is not None and cfg.min_val <= value <= cfg.max_val:
                return BaselineState(baseline=value, spread=cfg.floor_spread, n_valid=1,
                                     nights_since_update=0, status=BaselineStatus.CALIBRATING)
            seed = (cfg.min_val + cfg.max_val) / 2.0
            return BaselineState(baseline=seed, spread=cfg.floor_spread, n_valid=0,
                                 nights_since_update=1, status=BaselineStatus.CALIBRATING)

        if value is None:
            m = state.nights_since_update + 1
            return BaselineState(baseline=state.baseline, spread=state.spread,
                                 n_valid=state.n_valid, nights_since_update=m,
                                 status=Baselines._compute_status(state.n_valid, m))

        if not (cfg.min_val <= value <= cfg.max_val):
            m = state.nights_since_update + 1
            return BaselineState(baseline=state.baseline, spread=state.spread,
                                 n_valid=state.n_valid, nights_since_update=m,
                                 status=Baselines._compute_status(state.n_valid, m))

        if state.n_valid >= Baselines.MIN_NIGHTS_SEED:
            dev = abs(value - state.baseline)
            if dev > Baselines.HARD_OUTLIER_K * state.spread:
                return BaselineState(baseline=state.baseline, spread=state.spread,
                                     n_valid=state.n_valid, nights_since_update=0,
                                     status=Baselines._compute_status(state.n_valid, 0))

        if state.n_valid == 0:
            return BaselineState(baseline=value, spread=cfg.floor_spread, n_valid=1,
                                 nights_since_update=0, status=BaselineStatus.CALIBRATING)

        lo = state.baseline - Baselines.WINSOR_K * state.spread
        hi = state.baseline + Baselines.WINSOR_K * state.spread
        clamped = max(lo, min(hi, value))
        new_baseline = lb * clamped + (1.0 - lb) * state.baseline

        abs_dev = abs(value - new_baseline)
        new_spread = max(cfg.floor_spread, ls * abs_dev + (1.0 - ls) * state.spread)
        new_n = state.n_valid + 1

        return BaselineState(baseline=new_baseline, spread=new_spread, n_valid=new_n,
                             nights_since_update=0,
                             status=Baselines._compute_status(new_n, 0))
```

```python
# backend/src/airmg/analytics/__init__.py
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_baselines.py -v
```
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/airmg/analytics/ backend/tests/test_baselines.py
git commit -m "feat: port Baselines engine from NOOP Swift"
```

---

### Task 5: Recovery Scorer

**Files:**
- Create: `backend/src/airmg/analytics/recovery.py`
- Create: `backend/tests/test_recovery.py`

**Reference:** `noop/Packages/StrandAnalytics/Sources/StrandAnalytics/RecoveryScorer.swift`
**Reference tests:** `noop/Packages/StrandAnalytics/Tests/StrandAnalyticsTests/RecoveryScorerTests.swift`

- [ ] **Step 1: Read NOOP's RecoveryScorerTests.swift for oracle values**

```bash
cat noop/Packages/StrandAnalytics/Tests/StrandAnalyticsTests/RecoveryScorerTests.swift
```

- [ ] **Step 2: Write failing tests**

```python
# backend/tests/test_recovery.py
import math
from airmg.analytics.recovery import RecoveryScorer
from airmg.analytics.baselines import BaselineState, BaselineStatus


def _make_baseline(mean: float, spread: float, n_valid: int = 14) -> BaselineState:
    return BaselineState(
        baseline=mean, spread=spread, n_valid=n_valid,
        nights_since_update=0, status=BaselineStatus.TRUSTED,
    )


def test_z_score():
    z = RecoveryScorer.z_score(60.0, mean=50.0, spread=8.0)
    expected = (60.0 - 50.0) / (1.253 * 8.0)
    assert abs(z - expected) < 0.001


def test_recovery_at_baseline_near_58():
    hrv_b = _make_baseline(50.0, 8.0)
    rhr_b = _make_baseline(60.0, 3.0)
    score = RecoveryScorer.recovery(
        hrv=50.0, rhr=60.0, resp=None,
        hrv_baseline=hrv_b, rhr_baseline=rhr_b,
        resp_baseline=None, sleep_perf=0.85,
    )
    assert score is not None
    assert 50.0 < score < 66.0  # near population mean


def test_high_hrv_high_recovery():
    hrv_b = _make_baseline(50.0, 8.0)
    rhr_b = _make_baseline(60.0, 3.0)
    score = RecoveryScorer.recovery(
        hrv=75.0, rhr=50.0, resp=None,
        hrv_baseline=hrv_b, rhr_baseline=rhr_b,
        resp_baseline=None, sleep_perf=0.95,
    )
    assert score is not None
    assert score > 80.0


def test_low_hrv_low_recovery():
    hrv_b = _make_baseline(50.0, 8.0)
    rhr_b = _make_baseline(60.0, 3.0)
    score = RecoveryScorer.recovery(
        hrv=25.0, rhr=75.0, resp=None,
        hrv_baseline=hrv_b, rhr_baseline=rhr_b,
        resp_baseline=None, sleep_perf=0.60,
    )
    assert score is not None
    assert score < 30.0


def test_cold_start_returns_none():
    hrv_b = BaselineState(
        baseline=50.0, spread=8.0, n_valid=2,
        nights_since_update=0, status=BaselineStatus.CALIBRATING,
    )
    score = RecoveryScorer.recovery(
        hrv=50.0, rhr=60.0, resp=None,
        hrv_baseline=hrv_b, rhr_baseline=None,
        resp_baseline=None, sleep_perf=None,
    )
    assert score is None


def test_band_classification():
    assert RecoveryScorer.band(20.0) == "red"
    assert RecoveryScorer.band(50.0) == "yellow"
    assert RecoveryScorer.band(80.0) == "green"


def test_missing_drivers_renormalize():
    hrv_b = _make_baseline(50.0, 8.0)
    score = RecoveryScorer.recovery(
        hrv=50.0, rhr=60.0, resp=None,
        hrv_baseline=hrv_b, rhr_baseline=None,
        resp_baseline=None, sleep_perf=None,
    )
    assert score is not None  # works with HRV only
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_recovery.py -v
```

- [ ] **Step 4: Implement recovery.py**

```python
# backend/src/airmg/analytics/recovery.py
from __future__ import annotations

import math
from airmg.analytics.baselines import BaselineState


class RecoveryScorer:
    W_HRV = 0.60
    W_RHR = 0.20
    W_RESP = 0.05
    W_SLEEP = 0.15

    LOGISTIC_K = 1.6
    LOGISTIC_Z0 = -0.20
    POPULATION_MEAN = 58.0

    BAND_RED_MAX = 34.0
    BAND_YELLOW_MAX = 67.0

    SLEEP_PERF_CENTER = 0.85
    SLEEP_PERF_SCALE = 0.12

    RESTING_HR_WINDOW_S = 5 * 60

    @staticmethod
    def z_score(value: float, mean: float, spread: float) -> float:
        sigma = max(1.253 * spread, 1e-9)
        return (value - mean) / sigma

    @staticmethod
    def band(score: float) -> str:
        if score < RecoveryScorer.BAND_RED_MAX:
            return "red"
        if score < RecoveryScorer.BAND_YELLOW_MAX:
            return "yellow"
        return "green"

    @staticmethod
    def resting_hr(hr_samples: list[dict], start_ts: int, end_ts: int) -> int | None:
        seg = [s for s in hr_samples if start_ts <= s["ts"] <= end_ts]
        if not seg:
            return None
        window = RecoveryScorer.RESTING_HR_WINDOW_S
        means: list[float] = []
        t = start_ts
        while t < end_ts:
            win = [s for s in seg if t <= s["ts"] < t + window]
            if win:
                means.append(sum(s["value"] for s in win) / len(win))
            t += window
        floor_val = min(means) if means else sum(s["value"] for s in seg) / len(seg)
        return round(floor_val)

    @staticmethod
    def recovery(
        hrv: float,
        rhr: float,
        resp: float | None,
        hrv_baseline: BaselineState,
        rhr_baseline: BaselineState | None,
        resp_baseline: BaselineState | None,
        sleep_perf: float | None,
    ) -> float | None:
        if not hrv_baseline.usable:
            return None

        terms: list[tuple[float, float]] = []

        # HRV: higher is better
        terms.append((
            RecoveryScorer.z_score(hrv, hrv_baseline.baseline, hrv_baseline.spread),
            RecoveryScorer.W_HRV,
        ))

        # RHR: lower is better → invert
        if rhr_baseline is not None:
            terms.append((
                RecoveryScorer.z_score(rhr_baseline.baseline, rhr, rhr_baseline.spread),
                RecoveryScorer.W_RHR,
            ))

        # Resp: lower is better, optional
        if resp is not None and resp_baseline is not None:
            terms.append((
                RecoveryScorer.z_score(resp_baseline.baseline, resp, resp_baseline.spread),
                RecoveryScorer.W_RESP,
            ))

        # Sleep perf: centered at 0.85, no baseline
        if sleep_perf is not None:
            terms.append((
                (sleep_perf - RecoveryScorer.SLEEP_PERF_CENTER) / RecoveryScorer.SLEEP_PERF_SCALE,
                RecoveryScorer.W_SLEEP,
            ))

        if not terms:
            return None

        total_weight = sum(w for _, w in terms)
        if total_weight <= 0:
            return None

        z = sum(zi * wi for zi, wi in terms) / total_weight
        score = 100.0 / (1.0 + math.exp(-RecoveryScorer.LOGISTIC_K * (z - RecoveryScorer.LOGISTIC_Z0)))
        return max(0.0, min(100.0, score))
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_recovery.py -v
```
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/airmg/analytics/recovery.py backend/tests/test_recovery.py
git commit -m "feat: port RecoveryScorer from NOOP Swift"
```

---

### Task 6: Strain Scorer

**Files:**
- Create: `backend/src/airmg/analytics/strain.py`
- Create: `backend/tests/test_strain.py`

**Reference:** `noop/Packages/StrandAnalytics/Sources/StrandAnalytics/StrainScorer.swift`

- [ ] **Step 1: Read NOOP's StrainScorerTests.swift for oracle values**

```bash
cat noop/Packages/StrandAnalytics/Tests/StrandAnalyticsTests/StrainScorerTests.swift
```

- [ ] **Step 2: Write failing tests**

```python
# backend/tests/test_strain.py
import math
from airmg.analytics.strain import StrainScorer


def test_tanaka_hrmax():
    assert StrainScorer.tanaka_hrmax(30.0) == 187.0
    assert StrainScorer.tanaka_hrmax(40.0) == 180.0


def test_pct_hrr_clamped():
    assert StrainScorer.pct_hrr(60.0, resting_hr=60.0, hr_reserve=120.0) == 0.0
    assert StrainScorer.pct_hrr(180.0, resting_hr=60.0, hr_reserve=120.0) == 100.0
    mid = StrainScorer.pct_hrr(120.0, resting_hr=60.0, hr_reserve=120.0)
    assert abs(mid - 50.0) < 0.1


def test_zone_weight_below_50_is_zero():
    w = StrainScorer.zone_weight(70.0, resting_hr=60.0, hr_reserve=120.0)
    assert w == 0  # ~8.3% HRR, below zone 1


def test_zone_weight_zone_5():
    w = StrainScorer.zone_weight(175.0, resting_hr=60.0, hr_reserve=120.0)
    assert w == 5  # ~95.8% HRR, zone 5


def test_trimp_to_strain_zero():
    assert StrainScorer.trimp_to_strain(0) == 0
    assert StrainScorer.trimp_to_strain(-10) == 0


def test_trimp_to_strain_max():
    result = StrainScorer.trimp_to_strain(7200.0)
    assert abs(result - 21.0) < 0.01


def test_strain_from_samples():
    samples = [{"ts": i, "value": 150} for i in range(700)]
    result = StrainScorer.strain(samples, resting_hr=60.0, age=30)
    assert result is not None
    assert 0 < result <= 21.0


def test_strain_too_few_samples():
    samples = [{"ts": i, "value": 150} for i in range(100)]
    result = StrainScorer.strain(samples, resting_hr=60.0, age=30)
    assert result is None
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_strain.py -v
```

- [ ] **Step 4: Implement strain.py**

```python
# backend/src/airmg/analytics/strain.py
from __future__ import annotations

import math


class StrainScorer:
    MIN_READINGS = 600
    MAX_STRAIN = 21.0
    STRAIN_DENOMINATOR = 7201.0
    DEFAULT_AGE = 30
    DEFAULT_RESTING_HR = 60.0
    HRMAX_MIN_SAMPLES = 600
    HRMAX_PERCENTILE = 99.5

    EDWARDS_ZONES: list[tuple[float, int]] = [
        (90.0, 5), (80.0, 4), (70.0, 3), (60.0, 2), (50.0, 1),
    ]

    @staticmethod
    def tanaka_hrmax(age: float) -> float:
        return 208.0 - 0.7 * age

    @staticmethod
    def default_max_hr(age: int = DEFAULT_AGE) -> int:
        return 220 - age

    @staticmethod
    def percentile(sorted_values: list[float], pct: float) -> float:
        n = len(sorted_values)
        if n == 0:
            return 0
        if n == 1:
            return sorted_values[0]
        position = (pct / 100.0) * (n - 1)
        lower = int(position)
        upper = min(lower + 1, n - 1)
        frac = position - lower
        return sorted_values[lower] + frac * (sorted_values[upper] - sorted_values[lower])

    @staticmethod
    def estimate_hrmax(hr_history: list[float], age: float | None) -> tuple[float, str]:
        n = len(hr_history)
        tanaka = StrainScorer.tanaka_hrmax(age) if age is not None else None
        if n >= StrainScorer.HRMAX_MIN_SAMPLES:
            observed = StrainScorer.percentile(sorted(hr_history), StrainScorer.HRMAX_PERCENTILE)
            if tanaka is None:
                return (observed, "observed")
            return (observed, "observed") if observed >= tanaka else (tanaka, "tanaka")
        if tanaka is not None:
            return (tanaka, "tanaka")
        return (0.0, "unknown")

    @staticmethod
    def pct_hrr(bpm: float, resting_hr: float, hr_reserve: float) -> float:
        pct = (bpm - resting_hr) / hr_reserve * 100.0
        return max(0.0, min(100.0, pct))

    @staticmethod
    def zone_weight(bpm: float, resting_hr: float, hr_reserve: float) -> int:
        pct = (bpm - resting_hr) / hr_reserve * 100.0
        for threshold, weight in StrainScorer.EDWARDS_ZONES:
            if pct >= threshold:
                return weight
        return 0

    @staticmethod
    def trimp_to_strain(trimp: float, denominator: float = STRAIN_DENOMINATOR) -> float:
        if trimp <= 0:
            return 0
        value = StrainScorer.MAX_STRAIN * math.log(trimp + 1.0) / math.log(denominator)
        return round(value * 100) / 100

    @staticmethod
    def strain(
        hr_samples: list[dict],
        resting_hr: float,
        age: int = DEFAULT_AGE,
        method: str = "edwards",
    ) -> float | None:
        if len(hr_samples) < StrainScorer.MIN_READINGS:
            return None

        hrmax = StrainScorer.tanaka_hrmax(float(age))
        hr_reserve = hrmax - resting_hr
        if hr_reserve <= 0:
            return None

        if len(hr_samples) >= 2:
            sample_dur_min = abs(hr_samples[1]["ts"] - hr_samples[0]["ts"]) / 60.0
            if sample_dur_min <= 0:
                sample_dur_min = 1.0 / 60.0
        else:
            sample_dur_min = 1.0 / 60.0

        trimp = 0.0
        for s in hr_samples:
            bpm = float(s["value"])
            w = StrainScorer.zone_weight(bpm, resting_hr, hr_reserve)
            trimp += w * sample_dur_min

        return StrainScorer.trimp_to_strain(trimp)
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_strain.py -v
```
Expected: all PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/src/airmg/analytics/strain.py backend/tests/test_strain.py
git commit -m "feat: port StrainScorer from NOOP Swift"
```

---

### Task 7: HR Zones

**Files:**
- Create: `backend/src/airmg/analytics/zones.py`
- Create: `backend/tests/test_zones.py`

**Reference:** `noop/Packages/StrandAnalytics/Sources/StrandAnalytics/HRZones.swift`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_zones.py
from airmg.analytics.zones import HRZone, HRZoneSet, build_zones, time_in_zones


def test_build_zones_from_age():
    zs = build_zones(age=30)
    assert len(zs.zones) == 5
    assert zs.max_hr == 187.0  # Tanaka
    assert zs.zones[0].number == 1
    assert zs.zones[0].lower_pct == 0.50
    assert zs.zones[4].number == 5
    assert zs.zones[4].upper_pct == 1.00


def test_zone_number():
    zs = build_zones(age=30)
    assert zs.zone_number(100.0) == 1  # ~53% of 187
    assert zs.zone_number(175.0) == 5  # ~93% of 187
    assert zs.zone_number(50.0) == 0   # below zone 1


def test_time_in_zones():
    zs = build_zones(age=30)
    samples = [
        {"ts": 0, "value": 100},   # zone 1
        {"ts": 1, "value": 100},   # zone 1
        {"ts": 2, "value": 170},   # zone 4-5
        {"ts": 3, "value": 170},   # zone 4-5
    ]
    result = time_in_zones(zs, samples)
    assert len(result) == 5
    total = sum(result.values())
    assert total == 4  # all samples assigned
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement zones.py**

```python
# backend/src/airmg/analytics/zones.py
from __future__ import annotations

from dataclasses import dataclass

from airmg.analytics.strain import StrainScorer

ZONE_BANDS = [
    (1, 0.50, 0.60),
    (2, 0.60, 0.70),
    (3, 0.70, 0.80),
    (4, 0.80, 0.90),
    (5, 0.90, 1.00),
]


@dataclass(frozen=True, slots=True)
class HRZone:
    number: int
    lower: float
    upper: float
    lower_pct: float
    upper_pct: float


@dataclass(frozen=True, slots=True)
class HRZoneSet:
    zones: list[HRZone]
    max_hr: float
    source: str

    def zone_number(self, bpm: float) -> int:
        for z in reversed(self.zones):
            if bpm >= z.lower:
                return z.number
        return 0


def build_zones(age: int | None = None, manual_max_hr: float | None = None) -> HRZoneSet:
    if manual_max_hr is not None:
        max_hr = manual_max_hr
        source = "manual"
    elif age is not None:
        max_hr = StrainScorer.tanaka_hrmax(float(age))
        source = "tanaka"
    else:
        max_hr = StrainScorer.tanaka_hrmax(30.0)
        source = "tanaka"

    zones = []
    for num, lo_pct, hi_pct in ZONE_BANDS:
        zones.append(HRZone(
            number=num,
            lower=round(max_hr * lo_pct, 1),
            upper=round(max_hr * hi_pct, 1),
            lower_pct=lo_pct,
            upper_pct=hi_pct,
        ))
    return HRZoneSet(zones=zones, max_hr=max_hr, source=source)


def time_in_zones(zone_set: HRZoneSet, hr_samples: list[dict]) -> dict[int, int]:
    counts = {z.number: 0 for z in zone_set.zones}
    for s in hr_samples:
        zn = zone_set.zone_number(float(s["value"]))
        if zn > 0:
            counts[zn] += 1
    return counts
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_zones.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/airmg/analytics/zones.py backend/tests/test_zones.py
git commit -m "feat: port HR zones from NOOP Swift"
```

---

### Task 8: Correlation Engine

**Files:**
- Create: `backend/src/airmg/analytics/correlation.py`
- Create: `backend/tests/test_correlation.py`

**Reference:** `noop/Packages/StrandAnalytics/Sources/StrandAnalytics/CorrelationEngine.swift`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_correlation.py
import math
from airmg.analytics.correlation import CorrelationEngine


def test_perfect_positive_correlation():
    pairs = [(1.0, 2.0), (2.0, 4.0), (3.0, 6.0), (4.0, 8.0), (5.0, 10.0)]
    result = CorrelationEngine.pearson(pairs)
    assert result is not None
    assert abs(result.r - 1.0) < 0.001
    assert abs(result.slope - 2.0) < 0.001
    assert abs(result.intercept - 0.0) < 0.001


def test_perfect_negative_correlation():
    pairs = [(1.0, 10.0), (2.0, 8.0), (3.0, 6.0), (4.0, 4.0), (5.0, 2.0)]
    result = CorrelationEngine.pearson(pairs)
    assert result is not None
    assert abs(result.r - (-1.0)) < 0.001


def test_too_few_pairs_returns_none():
    assert CorrelationEngine.pearson([(1.0, 2.0), (2.0, 4.0)]) is None


def test_zero_variance_returns_none():
    pairs = [(1.0, 5.0), (1.0, 5.0), (1.0, 5.0)]
    assert CorrelationEngine.pearson(pairs) is None


def test_align_by_day():
    x = {"2026-06-01": 50.0, "2026-06-02": 55.0, "2026-06-03": 60.0}
    y = {"2026-06-01": 70.0, "2026-06-03": 80.0}
    result = CorrelationEngine.align_by_day(x, y)
    assert len(result) == 2
    assert result[0] == (50.0, 70.0)
    assert result[1] == (60.0, 80.0)


def test_lagged_correlation():
    x = {"2026-06-01": 10.0, "2026-06-02": 20.0, "2026-06-03": 30.0, "2026-06-04": 40.0}
    y = {"2026-06-02": 15.0, "2026-06-03": 25.0, "2026-06-04": 35.0, "2026-06-05": 45.0}
    result = CorrelationEngine.lagged(x, y, lag_days=1)
    assert result is not None
    assert abs(result.r - 1.0) < 0.001
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement correlation.py**

```python
# backend/src/airmg/analytics/correlation.py
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True, slots=True)
class Correlation:
    r: float
    n: int
    p_approx: float
    slope: float
    intercept: float


class CorrelationEngine:
    @staticmethod
    def _erf_approx(x: float) -> float:
        t = 1.0 / (1.0 + 0.3275911 * abs(x))
        poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
        result = 1.0 - poly * math.exp(-x * x)
        return result if x >= 0 else -result

    @staticmethod
    def _normal_cdf(x: float) -> float:
        return 0.5 * (1.0 + CorrelationEngine._erf_approx(x / math.sqrt(2.0)))

    @staticmethod
    def pearson(xy: list[tuple[float, float]]) -> Correlation | None:
        n = len(xy)
        if n < 3:
            return None

        n_f = float(n)
        sum_x = sum(p[0] for p in xy)
        sum_y = sum(p[1] for p in xy)
        mean_x = sum_x / n_f
        mean_y = sum_y / n_f

        ss_xx = sum((p[0] - mean_x) ** 2 for p in xy)
        ss_yy = sum((p[1] - mean_y) ** 2 for p in xy)
        ss_xy = sum((p[0] - mean_x) * (p[1] - mean_y) for p in xy)

        if ss_xx < 1e-15 or ss_yy < 1e-15:
            return None

        r = ss_xy / math.sqrt(ss_xx * ss_yy)
        slope = ss_xy / ss_xx
        intercept = mean_y - slope * mean_x

        r2 = r * r
        if r2 >= 1.0:
            p_approx = 0.0
        else:
            t_stat = r * math.sqrt((n - 2) / (1.0 - r2))
            p_approx = 2.0 * (1.0 - CorrelationEngine._normal_cdf(abs(t_stat)))

        return Correlation(r=r, n=n, p_approx=p_approx, slope=slope, intercept=intercept)

    @staticmethod
    def align_by_day(
        x: dict[str, float], y: dict[str, float]
    ) -> list[tuple[float, float]]:
        common = sorted(set(x.keys()) & set(y.keys()))
        return [(x[day], y[day]) for day in common]

    @staticmethod
    def lagged(
        x: dict[str, float], y: dict[str, float], lag_days: int = 1
    ) -> Correlation | None:
        pairs: list[tuple[float, float]] = []
        for day_str, x_val in sorted(x.items()):
            d = datetime.strptime(day_str, "%Y-%m-%d")
            shifted = (d + timedelta(days=lag_days)).strftime("%Y-%m-%d")
            if shifted in y:
                pairs.append((x_val, y[shifted]))
        return CorrelationEngine.pearson(pairs)
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_correlation.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/airmg/analytics/correlation.py backend/tests/test_correlation.py
git commit -m "feat: port CorrelationEngine from NOOP Swift"
```

---

### Task 9: Journal Catalog + Coach Engine

**Files:**
- Create: `backend/src/airmg/journal/catalog.py`
- Create: `backend/src/airmg/journal/__init__.py`
- Create: `backend/src/airmg/coach/engine.py`
- Create: `backend/src/airmg/coach/__init__.py`
- Create: `backend/tests/test_coach.py`

**Reference:** `noop/Strand/Data/JournalCatalog.swift`, `noop/Strand/Screens/CoachView.swift`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_coach.py
from airmg.coach.engine import CoachEngine, Recommendation
from airmg.journal.catalog import JournalCatalog


def test_starter_questions_exist():
    assert len(JournalCatalog.STARTER_QUESTIONS) == 10
    assert "Did you drink any alcohol?" in JournalCatalog.STARTER_QUESTIONS


def test_merge_catalog_dedupes():
    custom = ["Did you drink any alcohol?", "Did you meditate?"]
    result = JournalCatalog.merge_catalog(imported=[], custom=custom)
    alcohol_count = sum(1 for q in result if q.lower() == "did you drink any alcohol?")
    assert alcohol_count == 1
    assert "Did you meditate?" in result


def test_red_recovery_recommends_rest():
    recs = CoachEngine.recommendations(recovery=25.0, strain=5.0, sleep_perf=0.70)
    assert any(r.category == "recovery" for r in recs)
    assert any("rest" in r.message.lower() or "recover" in r.message.lower() for r in recs)


def test_green_recovery_recommends_push():
    recs = CoachEngine.recommendations(recovery=80.0, strain=5.0, sleep_perf=0.90)
    assert any("train" in r.message.lower() or "push" in r.message.lower() for r in recs)


def test_sleep_debt_alert():
    recs = CoachEngine.recommendations(recovery=50.0, strain=10.0, sleep_perf=0.55)
    assert any("sleep" in r.message.lower() for r in recs)


def test_no_data_returns_empty():
    recs = CoachEngine.recommendations(recovery=None, strain=None, sleep_perf=None)
    assert len(recs) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement journal/catalog.py**

```python
# backend/src/airmg/journal/catalog.py
from __future__ import annotations


class JournalCatalog:
    STARTER_QUESTIONS: list[str] = [
        "Did you drink any alcohol?",
        "Did you have caffeine late in the day?",
        "Did you view a screen in bed?",
        "Did you eat close to bedtime?",
        "Did you feel stressed?",
        "Did you use a sauna?",
        "Did you share your bed?",
        "Did you feel sick or ill?",
        "Did you take magnesium?",
        "Did you read before bed?",
    ]

    @staticmethod
    def merge_catalog(imported: list[str], custom: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for q in imported + JournalCatalog.STARTER_QUESTIONS + custom:
            t = q.strip()
            if t and t.lower() not in seen:
                seen.add(t.lower())
                out.append(t)
        return out
```

```python
# backend/src/airmg/journal/__init__.py
```

- [ ] **Step 4: Implement coach/engine.py**

```python
# backend/src/airmg/coach/engine.py
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Recommendation:
    category: str
    message: str
    priority: int  # 1=high, 2=medium, 3=low


class CoachEngine:
    BAND_RED_MAX = 34.0
    BAND_YELLOW_MAX = 67.0
    SLEEP_DEBT_THRESHOLD = 0.70
    HIGH_STRAIN_THRESHOLD = 15.0

    @staticmethod
    def recommendations(
        recovery: float | None = None,
        strain: float | None = None,
        sleep_perf: float | None = None,
    ) -> list[Recommendation]:
        recs: list[Recommendation] = []

        if recovery is None and strain is None and sleep_perf is None:
            return recs

        if recovery is not None:
            if recovery < CoachEngine.BAND_RED_MAX:
                recs.append(Recommendation(
                    category="recovery",
                    message="Recovery is in the red zone. Focus on rest and active recovery today. Avoid intense training.",
                    priority=1,
                ))
            elif recovery < CoachEngine.BAND_YELLOW_MAX:
                recs.append(Recommendation(
                    category="recovery",
                    message="Recovery is moderate. Light to moderate training is appropriate. Listen to your body.",
                    priority=2,
                ))
            else:
                recs.append(Recommendation(
                    category="recovery",
                    message="Recovery is green. Your body is ready to push — high intensity training is appropriate today.",
                    priority=3,
                ))

        if sleep_perf is not None and sleep_perf < CoachEngine.SLEEP_DEBT_THRESHOLD:
            recs.append(Recommendation(
                category="sleep",
                message=f"Sleep performance is low ({sleep_perf:.0%}). Prioritize an earlier bedtime tonight to reduce sleep debt.",
                priority=1,
            ))

        if strain is not None and recovery is not None:
            if strain > CoachEngine.HIGH_STRAIN_THRESHOLD and recovery < CoachEngine.BAND_YELLOW_MAX:
                recs.append(Recommendation(
                    category="strain",
                    message="High strain on incomplete recovery. Consider reducing intensity tomorrow to avoid overtraining.",
                    priority=1,
                ))

        recs.sort(key=lambda r: r.priority)
        return recs
```

```python
# backend/src/airmg/coach/__init__.py
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_coach.py -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/airmg/journal/ backend/src/airmg/coach/ backend/tests/test_coach.py
git commit -m "feat: add journal catalog and coach engine"
```

---

### Task 8b: Comparison Engine

**Files:**
- Create: `backend/src/airmg/analytics/comparison.py`
- Create: `backend/tests/test_comparison.py`

**Reference:** `noop/Packages/StrandAnalytics/Sources/StrandAnalytics/ComparisonEngine.swift`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_comparison.py
from airmg.analytics.comparison import ComparisonEngine


def test_compare_periods():
    current = [
        {"day": "2026-06-08", "recovery": 70.0, "strain": 12.0},
        {"day": "2026-06-09", "recovery": 65.0, "strain": 14.0},
        {"day": "2026-06-10", "recovery": 80.0, "strain": 10.0},
    ]
    previous = [
        {"day": "2026-06-01", "recovery": 60.0, "strain": 15.0},
        {"day": "2026-06-02", "recovery": 55.0, "strain": 16.0},
        {"day": "2026-06-03", "recovery": 50.0, "strain": 13.0},
    ]
    result = ComparisonEngine.compare(current, previous, metrics=["recovery", "strain"])
    assert "recovery" in result
    assert result["recovery"]["current_avg"] > result["recovery"]["previous_avg"]
    assert result["recovery"]["delta"] > 0
    assert "strain" in result


def test_compare_empty_returns_none():
    result = ComparisonEngine.compare([], [], metrics=["recovery"])
    assert result["recovery"]["current_avg"] is None


def test_compare_single_metric():
    current = [{"day": "2026-06-10", "recovery": 75.0}]
    previous = [{"day": "2026-06-03", "recovery": 60.0}]
    result = ComparisonEngine.compare(current, previous, metrics=["recovery"])
    assert result["recovery"]["delta"] == 15.0
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement comparison.py**

```python
# backend/src/airmg/analytics/comparison.py
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PeriodComparison:
    current_avg: float | None
    previous_avg: float | None
    delta: float | None
    pct_change: float | None


class ComparisonEngine:
    @staticmethod
    def _avg(days: list[dict], metric: str) -> float | None:
        vals = [d[metric] for d in days if d.get(metric) is not None]
        if not vals:
            return None
        return sum(vals) / len(vals)

    @staticmethod
    def compare(
        current: list[dict],
        previous: list[dict],
        metrics: list[str],
    ) -> dict[str, dict]:
        result = {}
        for m in metrics:
            c_avg = ComparisonEngine._avg(current, m)
            p_avg = ComparisonEngine._avg(previous, m)
            delta = None
            pct = None
            if c_avg is not None and p_avg is not None:
                delta = round(c_avg - p_avg, 2)
                if p_avg != 0:
                    pct = round((c_avg - p_avg) / p_avg * 100, 1)
            result[m] = {
                "current_avg": round(c_avg, 2) if c_avg is not None else None,
                "previous_avg": round(p_avg, 2) if p_avg is not None else None,
                "delta": delta,
                "pct_change": pct,
            }
        return result
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_comparison.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/airmg/analytics/comparison.py backend/tests/test_comparison.py
git commit -m "feat: port ComparisonEngine from NOOP Swift"
```

---

## Phase 3: Google Health API Integration

### Task 10: Google OAuth Flow

**Files:**
- Create: `backend/src/airmg/auth/__init__.py`
- Create: `backend/src/airmg/auth/oauth.py`
- Create: `backend/src/airmg/auth/tokens.py`
- Create: `backend/src/airmg/routes/__init__.py`
- Create: `backend/src/airmg/routes/auth.py`

- [ ] **Step 1: Implement tokens.py**

```python
# backend/src/airmg/auth/tokens.py
from __future__ import annotations

import json
from pathlib import Path

from airmg.config import TOKENS_PATH


def save_credentials(creds_data: dict) -> None:
    TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKENS_PATH.write_text(json.dumps(creds_data, indent=2))


def load_credentials() -> dict | None:
    if not TOKENS_PATH.exists():
        return None
    return json.loads(TOKENS_PATH.read_text())


def clear_credentials() -> None:
    if TOKENS_PATH.exists():
        TOKENS_PATH.unlink()


def is_authenticated() -> bool:
    creds = load_credentials()
    return creds is not None and "token" in creds
```

```python
# backend/src/airmg/auth/__init__.py
```

- [ ] **Step 2: Implement oauth.py**

```python
# backend/src/airmg/auth/oauth.py
from __future__ import annotations

from google_auth_oauthlib.flow import Flow

from airmg.config import CLIENT_SECRETS_PATH, GOOGLE_HEALTH_SCOPES, OAUTH_REDIRECT_URI


def create_flow() -> Flow:
    flow = Flow.from_client_secrets_file(
        str(CLIENT_SECRETS_PATH),
        scopes=GOOGLE_HEALTH_SCOPES,
        redirect_uri=OAUTH_REDIRECT_URI,
    )
    return flow


def get_authorization_url() -> tuple[str, str]:
    flow = create_flow()
    url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url, state


def exchange_code(code: str) -> dict:
    flow = create_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or []),
    }
```

- [ ] **Step 3: Create auth routes**

```python
# backend/src/airmg/routes/__init__.py
```

```python
# backend/src/airmg/routes/auth.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from airmg.auth.oauth import exchange_code, get_authorization_url
from airmg.auth.tokens import clear_credentials, is_authenticated, save_credentials

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
def login():
    url, state = get_authorization_url()
    return RedirectResponse(url)


@router.get("/callback")
def callback(code: str, state: str | None = None):
    creds_data = exchange_code(code)
    save_credentials(creds_data)
    return RedirectResponse("http://localhost:5173?auth=success")


@router.get("/status")
def auth_status():
    return {"authenticated": is_authenticated()}


@router.post("/logout")
def logout():
    clear_credentials()
    return {"status": "logged_out"}
```

- [ ] **Step 4: Register auth router in main.py**

Add to `backend/src/airmg/main.py`:

```python
from airmg.routes.auth import router as auth_router

app.include_router(auth_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/airmg/auth/ backend/src/airmg/routes/
git commit -m "feat: add Google OAuth flow for Health API"
```

---

### Task 11: Google Health API Client + Sync

**Files:**
- Create: `backend/src/airmg/sync/__init__.py`
- Create: `backend/src/airmg/sync/client.py`
- Create: `backend/src/airmg/sync/mapper.py`
- Create: `backend/src/airmg/routes/sync.py`

- [ ] **Step 1: Implement client.py**

```python
# backend/src/airmg/sync/client.py
from __future__ import annotations

import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from airmg.auth.tokens import load_credentials, save_credentials
from airmg.config import GOOGLE_HEALTH_BASE


def _get_credentials() -> Credentials:
    creds_data = load_credentials()
    if creds_data is None:
        raise RuntimeError("Not authenticated. Connect Google Health first.")
    creds = Credentials(
        token=creds_data["token"],
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data.get("token_uri"),
        client_id=creds_data.get("client_id"),
        client_secret=creds_data.get("client_secret"),
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        save_credentials({
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or []),
        })
    return creds


def fetch_data_points(data_type: str, start_ts: int, end_ts: int) -> list[dict]:
    creds = _get_credentials()
    url = f"{GOOGLE_HEALTH_BASE}/users/me/dataTypes/{data_type}/dataPoints"
    headers = {"Authorization": f"Bearer {creds.token}"}
    params = {
        "startTime": f"{start_ts}s",
        "endTime": f"{end_ts}s",
    }
    all_points: list[dict] = []
    with httpx.Client() as client:
        while True:
            resp = client.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            all_points.extend(data.get("dataPoints", []))
            next_token = data.get("nextPageToken")
            if not next_token:
                break
            params["pageToken"] = next_token
    return all_points
```

```python
# backend/src/airmg/sync/__init__.py
```

- [ ] **Step 2: Implement mapper.py**

```python
# backend/src/airmg/sync/mapper.py
from __future__ import annotations

import json


def map_heart_rate(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        ts = int(dp.get("startTime", "0").rstrip("s"))
        for val in dp.get("values", []):
            if "fpVal" in val:
                samples.append({"type": "hr", "ts": ts, "value": val["fpVal"]})
            elif "intVal" in val:
                samples.append({"type": "hr", "ts": ts, "value": float(val["intVal"])})
    return samples


def map_hrv(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        ts = int(dp.get("startTime", "0").rstrip("s"))
        for val in dp.get("values", []):
            if "fpVal" in val:
                samples.append({"type": "hrv", "ts": ts, "value": val["fpVal"]})
    return samples


def map_sleep_sessions(data_points: list[dict]) -> list[dict]:
    sessions = []
    for dp in data_points:
        start = int(dp.get("startTime", "0").rstrip("s"))
        end = int(dp.get("endTime", "0").rstrip("s"))
        stages = []
        for val in dp.get("values", []):
            if "mapVal" in val:
                for entry in val["mapVal"]:
                    stages.append({
                        "start": int(entry.get("startTime", "0").rstrip("s")),
                        "end": int(entry.get("endTime", "0").rstrip("s")),
                        "stage": _map_sleep_stage(entry.get("value", {}).get("intVal", 0)),
                    })
        duration = end - start
        wake_time = sum(s["end"] - s["start"] for s in stages if s["stage"] == "wake")
        efficiency = (duration - wake_time) / duration if duration > 0 else 0.0
        sessions.append({
            "start_ts": start,
            "end_ts": end,
            "efficiency": efficiency,
            "stages_json": json.dumps(stages) if stages else None,
        })
    return sessions


def map_workouts(data_points: list[dict]) -> list[dict]:
    workouts = []
    for dp in data_points:
        start = int(dp.get("startTime", "0").rstrip("s"))
        end = int(dp.get("endTime", "0").rstrip("s"))
        workout_type = None
        calories = None
        for val in dp.get("values", []):
            if "stringVal" in val:
                workout_type = val["stringVal"]
            if "fpVal" in val and workout_type is None:
                calories = val["fpVal"]
        workouts.append({
            "start_ts": start,
            "end_ts": end,
            "type": workout_type,
            "calories": calories,
        })
    return workouts


def map_spo2(data_points: list[dict]) -> list[dict]:
    return [
        {"type": "spo2", "ts": int(dp.get("startTime", "0").rstrip("s")), "value": dp["values"][0]["fpVal"]}
        for dp in data_points if dp.get("values")
    ]


def map_steps(data_points: list[dict]) -> list[dict]:
    steps = []
    for dp in data_points:
        for val in dp.get("values", []):
            if "intVal" in val:
                steps.append({"ts": int(dp.get("startTime", "0").rstrip("s")), "value": val["intVal"]})
    return steps


def _map_sleep_stage(stage_int: int) -> str:
    mapping = {1: "wake", 2: "light", 3: "deep", 4: "rem", 5: "light", 6: "wake"}
    return mapping.get(stage_int, "light")
```

- [ ] **Step 3: Create sync route**

```python
# backend/src/airmg/routes/sync.py
from __future__ import annotations

import time
from datetime import datetime, timedelta

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_sync_state
from airmg.store.writes import (
    set_sync_state,
    upsert_samples,
    upsert_sleep_session,
    upsert_workout,
)
from airmg.sync.client import fetch_data_points
from airmg.sync.mapper import map_heart_rate, map_hrv, map_sleep_sessions, map_spo2, map_workouts

router = APIRouter(prefix="/sync", tags=["sync"])

DATA_TYPES = {
    "heart_rate": ("com.google.heart_rate.bpm", map_heart_rate),
    "hrv": ("com.google.heart_rate.variability", map_hrv),
    "sleep": ("com.google.sleep.segment", map_sleep_sessions),
    "spo2": ("com.google.oxygen_saturation", map_spo2),
    "workouts": ("com.google.activity.segment", map_workouts),
}

DEFAULT_LOOKBACK_DAYS = 90


@router.post("/start")
def start_sync():
    conn = get_connection(DB_PATH)
    results = {}
    now = int(time.time())

    for key, (data_type, mapper) in DATA_TYPES.items():
        state = get_sync_state(conn, key)
        if state and state["last_synced_ts"]:
            start_ts = state["last_synced_ts"]
        else:
            start_ts = int((datetime.now() - timedelta(days=DEFAULT_LOOKBACK_DAYS)).timestamp())

        raw = fetch_data_points(data_type, start_ts, now)
        mapped = mapper(raw)

        if key == "sleep":
            for s in mapped:
                upsert_sleep_session(conn, **s)
        elif key == "workouts":
            for w in mapped:
                upsert_workout(conn, **w)
        else:
            upsert_samples(conn, mapped)

        set_sync_state(conn, key, now)
        results[key] = len(mapped)

    conn.close()
    return {"synced": results}


@router.get("/status")
def sync_status():
    conn = get_connection(DB_PATH)
    states = {}
    for key in DATA_TYPES:
        s = get_sync_state(conn, key)
        states[key] = {
            "last_synced": datetime.fromtimestamp(s["last_synced_ts"]).isoformat() if s and s["last_synced_ts"] else None,
        }
    conn.close()
    return {"sync_states": states}
```

- [ ] **Step 4: Register sync router in main.py**

Add to `backend/src/airmg/main.py`:

```python
from airmg.routes.sync import router as sync_router

app.include_router(sync_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/airmg/sync/ backend/src/airmg/routes/sync.py backend/src/airmg/main.py
git commit -m "feat: add Google Health API client and sync pipeline"
```

---

## Phase 4: API Routes

### Task 12: Dashboard + Analytics Routes

**Files:**
- Create: `backend/src/airmg/routes/dashboard.py`
- Create: `backend/src/airmg/routes/sleep.py`
- Create: `backend/src/airmg/routes/recovery.py`
- Create: `backend/src/airmg/routes/strain.py`
- Create: `backend/src/airmg/routes/workouts.py`
- Create: `backend/src/airmg/routes/trends.py`
- Create: `backend/src/airmg/routes/insights.py`
- Create: `backend/src/airmg/routes/coach.py`
- Create: `backend/src/airmg/routes/journal.py`
- Create: `backend/src/airmg/routes/settings.py`

- [ ] **Step 1: Create dashboard.py**

```python
# backend/src/airmg/routes/dashboard.py
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range, get_today_metrics

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/today")
def today():
    conn = get_connection(DB_PATH)
    metrics = get_today_metrics(conn)
    conn.close()
    if metrics is None:
        return {"status": "no_data", "message": "No data for today. Sync first."}
    return metrics


@router.get("/week")
def week():
    conn = get_connection(DB_PATH)
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=6)).isoformat()
    days = get_daily_metrics_range(conn, start, end)
    conn.close()
    return {"days": days}
```

- [ ] **Step 2: Create sleep.py**

```python
# backend/src/airmg/routes/sleep.py
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection

router = APIRouter(prefix="/api/sleep", tags=["sleep"])


@router.get("/{day}")
def sleep_detail(day: str):
    conn = get_connection(DB_PATH)
    start_ts = int(datetime.strptime(day, "%Y-%m-%d").timestamp())
    end_ts = start_ts + 86400
    row = conn.execute(
        "SELECT * FROM sleep_sessions WHERE start_ts >= ? AND start_ts < ? ORDER BY start_ts DESC LIMIT 1",
        (start_ts - 43200, end_ts),  # look back 12h for overnight sleep
    ).fetchone()
    daily = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (day,)).fetchone()
    conn.close()
    if row is None:
        return {"status": "no_data"}
    session = dict(row)
    if session.get("stages_json"):
        session["stages"] = json.loads(session["stages_json"])
        del session["stages_json"]
    if daily:
        session["sleep_minutes"] = daily["sleep_minutes"]
        session["deep_minutes"] = daily["deep_minutes"]
        session["rem_minutes"] = daily["rem_minutes"]
        session["light_minutes"] = daily["light_minutes"]
    return session
```

- [ ] **Step 3: Create recovery.py, strain.py, workouts.py**

```python
# backend/src/airmg/routes/recovery.py
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_all_baselines, get_daily_metrics_range

router = APIRouter(prefix="/api/recovery", tags=["recovery"])


@router.get("/{day}")
def recovery_detail(day: str):
    conn = get_connection(DB_PATH)
    daily = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (day,)).fetchone()
    baselines = get_all_baselines(conn)
    trend_start = (date.fromisoformat(day) - timedelta(days=13)).isoformat()
    trend = get_daily_metrics_range(conn, trend_start, day)
    conn.close()
    if daily is None:
        return {"status": "no_data"}
    return {
        "day": day,
        "recovery": daily["recovery"],
        "hrv_rmssd": daily["hrv_rmssd"],
        "resting_hr": daily["resting_hr"],
        "resp_rate": daily["resp_rate"],
        "sleep_performance": daily["sleep_performance"],
        "baselines": baselines,
        "trend": [{"day": d["day"], "recovery": d["recovery"]} for d in trend],
    }
```

```python
# backend/src/airmg/routes/strain.py
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range, get_samples_range

router = APIRouter(prefix="/api/strain", tags=["strain"])


@router.get("/{day}")
def strain_detail(day: str):
    conn = get_connection(DB_PATH)
    daily = conn.execute("SELECT * FROM daily_metrics WHERE day = ?", (day,)).fetchone()
    trend_start = (date.fromisoformat(day) - timedelta(days=6)).isoformat()
    trend = get_daily_metrics_range(conn, trend_start, day)
    conn.close()
    if daily is None:
        return {"status": "no_data"}
    return {
        "day": day,
        "strain": daily["strain"],
        "calories": daily["calories"],
        "trend": [{"day": d["day"], "strain": d["strain"]} for d in trend],
    }
```

```python
# backend/src/airmg/routes/workouts.py
from __future__ import annotations

from fastapi import APIRouter, Query

from airmg.config import DB_PATH
from airmg.store.db import get_connection

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.get("")
def list_workouts(limit: int = Query(20, le=100), offset: int = Query(0, ge=0)):
    conn = get_connection(DB_PATH)
    rows = conn.execute(
        "SELECT * FROM workouts ORDER BY start_ts DESC LIMIT ? OFFSET ?", (limit, offset)
    ).fetchall()
    conn.close()
    return {"workouts": [dict(r) for r in rows]}


@router.get("/{workout_id}")
def workout_detail(workout_id: int):
    conn = get_connection(DB_PATH)
    row = conn.execute("SELECT * FROM workouts WHERE id = ?", (workout_id,)).fetchone()
    conn.close()
    if row is None:
        return {"status": "not_found"}
    return dict(row)
```

- [ ] **Step 4: Create trends.py, insights.py**

```python
# backend/src/airmg/routes/trends.py
from __future__ import annotations

from fastapi import APIRouter, Query

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("")
def trends(
    start: str = Query(..., description="yyyy-MM-dd"),
    end: str = Query(..., description="yyyy-MM-dd"),
    metrics: str = Query("recovery,strain,hrv_rmssd", description="comma-separated metric names"),
):
    conn = get_connection(DB_PATH)
    days = get_daily_metrics_range(conn, start, end)
    conn.close()
    keys = [m.strip() for m in metrics.split(",")]
    return {
        "days": [
            {"day": d["day"], **{k: d.get(k) for k in keys}} for d in days
        ]
    }
```

```python
# backend/src/airmg/routes/insights.py
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter

from airmg.analytics.correlation import CorrelationEngine
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range, get_journal_entries

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("")
def insights():
    conn = get_connection(DB_PATH)
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
                result = CorrelationEngine.lagged(x, y, lag_days=lag)
            else:
                pairs = CorrelationEngine.align_by_day(x, y)
                result = CorrelationEngine.pearson(pairs)
            if result:
                correlations.append({
                    "x": x_key, "y": y_key, "lag": lag,
                    "r": round(result.r, 3), "n": result.n,
                    "p": round(result.p_approx, 4),
                })

    conn.close()
    return {"correlations": correlations}
```

- [ ] **Step 5: Create coach.py, journal.py, settings.py**

```python
# backend/src/airmg/routes/coach.py
from __future__ import annotations

from fastapi import APIRouter

from airmg.coach.engine import CoachEngine
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_today_metrics

router = APIRouter(prefix="/api/coach", tags=["coach"])


@router.get("")
def coach():
    conn = get_connection(DB_PATH)
    today = get_today_metrics(conn)
    conn.close()
    if today is None:
        return {"recommendations": []}
    recs = CoachEngine.recommendations(
        recovery=today.get("recovery"),
        strain=today.get("strain"),
        sleep_perf=today.get("sleep_performance"),
    )
    return {"recommendations": [{"category": r.category, "message": r.message, "priority": r.priority} for r in recs]}
```

```python
# backend/src/airmg/routes/journal.py
from __future__ import annotations

import time

from fastapi import APIRouter
from pydantic import BaseModel

from airmg.config import DB_PATH
from airmg.journal.catalog import JournalCatalog
from airmg.store.db import get_connection
from airmg.store.reads import get_journal_entries
from airmg.store.writes import upsert_journal_entry

router = APIRouter(prefix="/api/journal", tags=["journal"])


class JournalEntryIn(BaseModel):
    day: str
    question_key: str
    answer: str


@router.get("/catalog")
def catalog():
    return {"questions": JournalCatalog.merge_catalog(imported=[], custom=[])}


@router.get("")
def journal_list(day: str):
    conn = get_connection(DB_PATH)
    entries = get_journal_entries(conn, day)
    conn.close()
    return {"entries": entries}


@router.post("")
def journal_create(entry: JournalEntryIn):
    conn = get_connection(DB_PATH)
    upsert_journal_entry(conn, entry.day, entry.question_key, entry.answer, int(time.time()))
    conn.close()
    return {"status": "ok"}
```

```python
# backend/src/airmg/routes/settings.py
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
```

- [ ] **Step 5b: Create metrics explorer + CSV export**

```python
# backend/src/airmg/routes/explorer.py
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

METRIC_CATALOG = [
    {"key": "hrv_rmssd", "title": "HRV (RMSSD)", "category": "Heart", "unit": "ms", "higher_is_better": True},
    {"key": "resting_hr", "title": "Resting Heart Rate", "category": "Heart", "unit": "bpm", "higher_is_better": False},
    {"key": "recovery", "title": "Recovery", "category": "Recovery", "unit": "%", "higher_is_better": True},
    {"key": "strain", "title": "Strain", "category": "Strain", "unit": "", "higher_is_better": None},
    {"key": "sleep_performance", "title": "Sleep Performance", "category": "Sleep", "unit": "%", "higher_is_better": True},
    {"key": "sleep_minutes", "title": "Sleep Duration", "category": "Sleep", "unit": "min", "higher_is_better": True},
    {"key": "deep_minutes", "title": "Deep Sleep", "category": "Sleep", "unit": "min", "higher_is_better": True},
    {"key": "rem_minutes", "title": "REM Sleep", "category": "Sleep", "unit": "min", "higher_is_better": True},
    {"key": "resp_rate", "title": "Respiratory Rate", "category": "Health", "unit": "rpm", "higher_is_better": False},
    {"key": "spo2", "title": "Blood Oxygen", "category": "Health", "unit": "%", "higher_is_better": True},
    {"key": "skin_temp", "title": "Skin Temperature", "category": "Health", "unit": "°C", "higher_is_better": None},
    {"key": "steps", "title": "Steps", "category": "Strain", "unit": "", "higher_is_better": True},
    {"key": "calories", "title": "Calories", "category": "Strain", "unit": "kcal", "higher_is_better": None},
]


@router.get("/explorer")
def explorer():
    return {"metrics": METRIC_CATALOG}
```

```python
# backend/src/airmg/routes/export.py
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/export/csv")
def export_csv(
    start: str = Query(..., description="yyyy-MM-dd"),
    end: str = Query(..., description="yyyy-MM-dd"),
):
    conn = get_connection(DB_PATH)
    days = get_daily_metrics_range(conn, start, end)
    conn.close()

    if not days:
        return StreamingResponse(io.StringIO(""), media_type="text/csv")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=days[0].keys())
    writer.writeheader()
    writer.writerows(days)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=airmg-{start}-{end}.csv"},
    )
```

- [ ] **Step 6: Register all routers in main.py**

Add to `backend/src/airmg/main.py`:

```python
from airmg.routes.dashboard import router as dashboard_router
from airmg.routes.sleep import router as sleep_router
from airmg.routes.recovery import router as recovery_router
from airmg.routes.strain import router as strain_router
from airmg.routes.workouts import router as workouts_router
from airmg.routes.trends import router as trends_router
from airmg.routes.insights import router as insights_router
from airmg.routes.coach import router as coach_router
from airmg.routes.journal import router as journal_router
from airmg.routes.settings import router as settings_router
from airmg.routes.explorer import router as explorer_router
from airmg.routes.export import router as export_router

app.include_router(dashboard_router)
app.include_router(sleep_router)
app.include_router(recovery_router)
app.include_router(strain_router)
app.include_router(workouts_router)
app.include_router(trends_router)
app.include_router(insights_router)
app.include_router(coach_router)
app.include_router(journal_router)
app.include_router(settings_router)
app.include_router(explorer_router)
app.include_router(export_router)
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/airmg/routes/ backend/src/airmg/main.py
git commit -m "feat: add all API routes (dashboard, sleep, recovery, strain, workouts, trends, insights, coach, journal, settings)"
```

---

### Task 13: Daily Metrics Computation Pipeline

**Files:**
- Create: `backend/src/airmg/analytics/pipeline.py`
- Create: `backend/tests/test_pipeline.py`

This runs after each sync — processes raw data into daily_metrics using the analytics engines.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_pipeline.py
import tempfile
from datetime import date
from pathlib import Path

from airmg.analytics.pipeline import compute_daily_metrics
from airmg.store.db import get_connection, init_db
from airmg.store.reads import get_daily_metrics_range, get_all_baselines
from airmg.store.writes import upsert_samples, upsert_sleep_session


def _setup_db():
    tmp = tempfile.mkdtemp()
    db_path = Path(tmp) / "test.db"
    init_db(db_path)
    return get_connection(db_path)


def test_compute_daily_metrics_basic():
    conn = _setup_db()
    day = "2026-06-10"
    base_ts = 1718000000

    hr_samples = [{"type": "hr", "ts": base_ts + i, "value": 65 + (i % 10)} for i in range(700)]
    hrv_samples = [{"type": "hrv", "ts": base_ts + i * 300, "value": 50.0 + (i % 5)} for i in range(20)]
    upsert_samples(conn, hr_samples)
    upsert_samples(conn, hrv_samples)

    upsert_sleep_session(conn, start_ts=base_ts - 28800, end_ts=base_ts - 3600,
                         efficiency=0.88, resting_hr=55, avg_hrv=48.0)

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
        upsert_sleep_session(conn, start_ts=day_ts - 28800, end_ts=day_ts - 3600,
                             efficiency=0.85, resting_hr=58, avg_hrv=50.0)
        compute_daily_metrics(conn, day_str)

    baselines = get_all_baselines(conn)
    assert "hrv" in baselines
    assert baselines["hrv"]["n_valid"] >= 4
    conn.close()
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement pipeline.py**

```python
# backend/src/airmg/analytics/pipeline.py
from __future__ import annotations

import sqlite3
from datetime import datetime

from airmg.analytics.baselines import BaselineState, BaselineStatus, Baselines
from airmg.analytics.recovery import RecoveryScorer
from airmg.analytics.strain import StrainScorer
from airmg.store.reads import get_baseline, get_samples_range
from airmg.store.writes import upsert_baseline, upsert_daily_metrics


def _day_ts_range(day: str) -> tuple[int, int]:
    dt = datetime.strptime(day, "%Y-%m-%d")
    start = int(dt.timestamp())
    return start, start + 86400


def _baseline_from_db(conn: sqlite3.Connection, metric: str) -> BaselineState | None:
    row = get_baseline(conn, metric)
    if row is None:
        return None
    return BaselineState(
        baseline=row["mean"],
        spread=row["spread"],
        n_valid=row["n_valid"],
        nights_since_update=row["nights_since_update"],
        status=BaselineStatus(row["status"]),
    )


def _save_baseline(conn: sqlite3.Connection, metric: str, state: BaselineState) -> None:
    upsert_baseline(conn, metric, state.baseline, state.spread,
                    state.n_valid, state.nights_since_update, state.status.value)


def compute_daily_metrics(conn: sqlite3.Connection, day: str) -> None:
    start_ts, end_ts = _day_ts_range(day)

    hr_data = get_samples_range(conn, "hr", start_ts, end_ts)
    hrv_data = get_samples_range(conn, "hrv", start_ts - 43200, end_ts)

    nightly_hrv = None
    if hrv_data:
        nightly_hrv = sum(s["value"] for s in hrv_data) / len(hrv_data)

    sleep_row = conn.execute(
        "SELECT * FROM sleep_sessions WHERE start_ts >= ? AND end_ts <= ? ORDER BY start_ts DESC LIMIT 1",
        (start_ts - 43200, end_ts),
    ).fetchone()

    resting_hr = None
    sleep_perf = None
    sleep_minutes = None
    deep_minutes = None
    rem_minutes = None
    light_minutes = None
    wake_minutes = None

    if sleep_row:
        resting_hr = sleep_row["resting_hr"]
        sleep_perf = sleep_row["efficiency"]
        if sleep_row["avg_hrv"] and nightly_hrv is None:
            nightly_hrv = sleep_row["avg_hrv"]
        duration = sleep_row["end_ts"] - sleep_row["start_ts"]
        sleep_minutes = duration // 60

    # Update baselines
    hrv_baseline = _baseline_from_db(conn, "hrv")
    hrv_baseline = Baselines.update(hrv_baseline, nightly_hrv, Baselines.HRV_CFG)
    _save_baseline(conn, "hrv", hrv_baseline)

    rhr_baseline = _baseline_from_db(conn, "resting_hr")
    rhr_val = float(resting_hr) if resting_hr else None
    rhr_baseline = Baselines.update(rhr_baseline, rhr_val, Baselines.RHR_CFG)
    _save_baseline(conn, "resting_hr", rhr_baseline)

    # Recovery
    recovery = None
    if nightly_hrv is not None and resting_hr is not None:
        recovery = RecoveryScorer.recovery(
            hrv=nightly_hrv,
            rhr=float(resting_hr),
            resp=None,
            hrv_baseline=hrv_baseline,
            rhr_baseline=rhr_baseline if rhr_baseline.usable else None,
            resp_baseline=None,
            sleep_perf=sleep_perf,
        )

    # Strain
    strain_val = None
    if hr_data:
        rhr_for_strain = float(resting_hr) if resting_hr else StrainScorer.DEFAULT_RESTING_HR
        strain_val = StrainScorer.strain(hr_data, resting_hr=rhr_for_strain, age=30)

    # Steps
    steps_row = conn.execute("SELECT total FROM steps WHERE day = ?", (day,)).fetchone()
    steps = steps_row["total"] if steps_row else None

    upsert_daily_metrics(conn, {
        "day": day,
        "recovery": recovery,
        "strain": strain_val,
        "sleep_performance": sleep_perf,
        "hrv_rmssd": nightly_hrv,
        "resting_hr": rhr_val,
        "sleep_minutes": sleep_minutes,
        "deep_minutes": deep_minutes,
        "rem_minutes": rem_minutes,
        "light_minutes": light_minutes,
        "wake_minutes": wake_minutes,
        "steps": steps,
    })
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest tests/test_pipeline.py -v
```

- [ ] **Step 5: Wire pipeline into sync route**

Add to `backend/src/airmg/routes/sync.py` after the sync loop:

```python
from datetime import date
from airmg.analytics.pipeline import compute_daily_metrics

# Add at the end of start_sync(), before conn.close():
    compute_daily_metrics(conn, date.today().isoformat())
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/airmg/analytics/pipeline.py backend/tests/test_pipeline.py backend/src/airmg/routes/sync.py
git commit -m "feat: add daily metrics computation pipeline"
```

---

## Phase 5: Frontend

### Task 14: Frontend Scaffold

**Files:**
- Create: `frontend/` (Vite + React + TS + Tailwind + shadcn)

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /Users/suryaprasad/projects/air_mg
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install Tailwind v4**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npm install tailwindcss @tailwindcss/vite
```

Add Tailwind plugin to `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/sync': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
```

Replace `src/index.css` with:

```css
@import "tailwindcss";

@theme {
  --color-bg-primary: #0a0a0a;
  --color-bg-secondary: #1a1a1a;
  --color-bg-tertiary: #2a2a2a;
  --color-accent: #18C98B;
  --color-accent-light: #2FE6A8;
  --color-recovery-red: #FF4444;
  --color-recovery-yellow: #FFBB33;
  --color-recovery-green: #18C98B;
  --color-text-primary: #E8E8E8;
  --color-text-secondary: #8B9690;
}
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npx shadcn@latest init
```

Select: TypeScript, New York style, CSS variables, dark theme default.

- [ ] **Step 4: Install Biome**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npm install --save-dev @biomejs/biome
npx biome init
```

- [ ] **Step 5: Install recharts**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npm install recharts
```

- [ ] **Step 6: Create API client**

```typescript
// frontend/src/api/client.ts
const BASE = '';

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
```

- [ ] **Step 7: Create shared types**

```typescript
// frontend/src/lib/types.ts
export interface DailyMetrics {
  day: string;
  recovery: number | null;
  strain: number | null;
  sleep_performance: number | null;
  hrv_rmssd: number | null;
  resting_hr: number | null;
  resp_rate: number | null;
  spo2: number | null;
  skin_temp: number | null;
  steps: number | null;
  calories: number | null;
  sleep_minutes: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  wake_minutes: number | null;
}

export interface SleepSession {
  id: number;
  start_ts: number;
  end_ts: number;
  efficiency: number | null;
  stages: StageSegment[] | null;
  resting_hr: number | null;
  avg_hrv: number | null;
}

export interface StageSegment {
  start: number;
  end: number;
  stage: 'wake' | 'light' | 'deep' | 'rem';
}

export interface Workout {
  id: number;
  start_ts: number;
  end_ts: number;
  type: string | null;
  calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  strain: number | null;
}

export interface Recommendation {
  category: string;
  message: string;
  priority: number;
}

export interface CorrelationResult {
  x: string;
  y: string;
  lag: number;
  r: number;
  n: number;
  p: number;
}
```

- [ ] **Step 8: Create color/format utilities**

```typescript
// frontend/src/lib/colors.ts
export function recoveryColor(score: number | null): string {
  if (score === null) return 'text-text-secondary';
  if (score < 34) return 'text-recovery-red';
  if (score < 67) return 'text-recovery-yellow';
  return 'text-recovery-green';
}

export function recoveryBg(score: number | null): string {
  if (score === null) return 'bg-bg-tertiary';
  if (score < 34) return 'bg-recovery-red/20';
  if (score < 67) return 'bg-recovery-yellow/20';
  return 'bg-recovery-green/20';
}

export function strainColor(strain: number | null): string {
  if (strain === null) return 'text-text-secondary';
  if (strain < 7) return 'text-blue-400';
  if (strain < 14) return 'text-recovery-yellow';
  return 'text-recovery-red';
}
```

```typescript
// frontend/src/lib/format.ts
export function formatMinutes(mins: number | null): string {
  if (mins === null) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatScore(score: number | null, decimals = 0): string {
  if (score === null) return '--';
  return score.toFixed(decimals);
}

export function formatPercent(value: number | null): string {
  if (value === null) return '--';
  return `${Math.round(value * 100)}%`;
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npm run dev
```
Open http://localhost:5173 — verify default Vite page renders.

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React frontend with Vite, Tailwind v4, shadcn/ui"
```

---

### Task 15: App Shell + Layout

**Files:**
- Create: `frontend/src/components/layout/Shell.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/App.tsx` (replace)

- [ ] **Step 1: Install react-router**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npm install react-router
```

- [ ] **Step 2: Install shadcn components needed**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npx shadcn@latest add button card badge separator scroll-area
```

- [ ] **Step 3: Create Sidebar**

```tsx
// frontend/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router';

const NAV_ITEMS = [
  { path: '/', label: 'Today', icon: '◉' },
  { path: '/sleep', label: 'Sleep', icon: '◐' },
  { path: '/recovery', label: 'Recovery', icon: '♥' },
  { path: '/strain', label: 'Strain', icon: '⚡' },
  { path: '/workouts', label: 'Workouts', icon: '▶' },
  { path: '/trends', label: 'Trends', icon: '↗' },
  { path: '/insights', label: 'Insights', icon: '◇' },
  { path: '/coach', label: 'Coach', icon: '★' },
  { path: '/journal', label: 'Journal', icon: '✎' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  return (
    <nav className="flex w-56 flex-col gap-1 border-r border-bg-tertiary bg-bg-secondary p-4">
      <div className="mb-6 px-2 text-xl font-bold text-accent">AirMG</div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            }`
          }
        >
          <span className="w-5 text-center">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Create Shell**

```tsx
// frontend/src/components/layout/Shell.tsx
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

export function Shell() {
  return (
    <div className="flex h-screen bg-bg-primary text-text-primary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Replace App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router';
import { Shell } from './components/layout/Shell';

function Placeholder({ name }: { name: string }) {
  return <div className="text-text-secondary">{name} — coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Placeholder name="Today" />} />
          <Route path="sleep" element={<Placeholder name="Sleep" />} />
          <Route path="recovery" element={<Placeholder name="Recovery" />} />
          <Route path="strain" element={<Placeholder name="Strain" />} />
          <Route path="workouts" element={<Placeholder name="Workouts" />} />
          <Route path="trends" element={<Placeholder name="Trends" />} />
          <Route path="insights" element={<Placeholder name="Insights" />} />
          <Route path="coach" element={<Placeholder name="Coach" />} />
          <Route path="journal" element={<Placeholder name="Journal" />} />
          <Route path="settings" element={<Placeholder name="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Verify in browser**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npm run dev
```
Open http://localhost:5173 — verify dark sidebar + navigation works.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add app shell with sidebar navigation"
```

---

### Task 16: Today Page

**Files:**
- Create: `frontend/src/pages/Today.tsx`
- Create: `frontend/src/components/shared/MetricCard.tsx`
- Create: `frontend/src/components/shared/ScoreBadge.tsx`
- Create: `frontend/src/components/charts/WeekStrip.tsx`
- Create: `frontend/src/hooks/useApi.ts`

**Skill:** invoke `frontend-design:frontend-design` before implementing. Reference `noop/Strand/Screens/TodayView.swift` for layout inspiration.

- [ ] **Step 1: Create useApi hook**

```tsx
// frontend/src/hooks/useApi.ts
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<T>(path)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path]);

  return { data, loading, error };
}
```

- [ ] **Step 2: Create shared components**

```tsx
// frontend/src/components/shared/MetricCard.tsx
import { Card } from '../ui/card';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}

export function MetricCard({ label, value, unit, color = 'text-text-primary' }: MetricCardProps) {
  return (
    <Card className="border-bg-tertiary bg-bg-secondary p-4">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-text-secondary">{unit}</span>}
      </div>
    </Card>
  );
}
```

```tsx
// frontend/src/components/shared/ScoreBadge.tsx
import { recoveryBg, recoveryColor } from '../../lib/colors';

interface ScoreBadgeProps {
  score: number | null;
  label: string;
  size?: 'sm' | 'lg';
}

export function ScoreBadge({ score, label, size = 'lg' }: ScoreBadgeProps) {
  const textSize = size === 'lg' ? 'text-5xl' : 'text-2xl';
  return (
    <div className={`flex flex-col items-center rounded-xl p-6 ${recoveryBg(score)}`}>
      <div className={`font-bold ${textSize} ${recoveryColor(score)}`}>
        {score !== null ? Math.round(score) : '--'}
      </div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create WeekStrip chart**

```tsx
// frontend/src/components/charts/WeekStrip.tsx
import type { DailyMetrics } from '../../lib/types';
import { recoveryColor } from '../../lib/colors';

interface WeekStripProps {
  days: DailyMetrics[];
}

export function WeekStrip({ days }: WeekStripProps) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div className="flex gap-2">
      {days.map((d) => {
        const dt = new Date(d.day + 'T00:00:00');
        return (
          <div key={d.day} className="flex flex-col items-center gap-1">
            <span className="text-xs text-text-secondary">{dayLabels[dt.getDay()]}</span>
            <div className={`text-lg font-bold ${recoveryColor(d.recovery)}`}>
              {d.recovery !== null ? Math.round(d.recovery) : '--'}
            </div>
            <span className="text-xs text-text-secondary">
              {d.strain !== null ? d.strain.toFixed(1) : '--'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create Today page**

```tsx
// frontend/src/pages/Today.tsx
import { ScoreBadge } from '../components/shared/ScoreBadge';
import { MetricCard } from '../components/shared/MetricCard';
import { WeekStrip } from '../components/charts/WeekStrip';
import { useApi } from '../hooks/useApi';
import { formatMinutes, formatScore } from '../lib/format';
import { strainColor } from '../lib/colors';
import type { DailyMetrics } from '../lib/types';

export default function Today() {
  const { data: today, loading } = useApi<DailyMetrics>('/api/today');
  const { data: weekData } = useApi<{ days: DailyMetrics[] }>('/api/week');

  if (loading) return <div className="text-text-secondary">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Today</h1>

      <div className="grid grid-cols-3 gap-4">
        <ScoreBadge score={today?.recovery ?? null} label="Recovery" />
        <div className="flex flex-col items-center rounded-xl bg-bg-secondary p-6">
          <div className={`text-5xl font-bold ${strainColor(today?.strain ?? null)}`}>
            {today?.strain !== null ? today?.strain?.toFixed(1) : '--'}
          </div>
          <div className="mt-1 text-sm text-text-secondary">Strain</div>
        </div>
        <div className="flex flex-col items-center rounded-xl bg-bg-secondary p-6">
          <div className="text-5xl font-bold text-blue-400">
            {formatMinutes(today?.sleep_minutes ?? null)}
          </div>
          <div className="mt-1 text-sm text-text-secondary">Sleep</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="HRV" value={formatScore(today?.hrv_rmssd ?? null, 1)} unit="ms" />
        <MetricCard label="Resting HR" value={formatScore(today?.resting_hr ?? null)} unit="bpm" />
        <MetricCard label="SpO2" value={formatScore(today?.spo2 ?? null, 1)} unit="%" />
        <MetricCard label="Steps" value={today?.steps?.toLocaleString() ?? '--'} />
      </div>

      {weekData?.days && weekData.days.length > 0 && (
        <div className="rounded-xl bg-bg-secondary p-4">
          <div className="mb-3 text-sm text-text-secondary">This Week</div>
          <WeekStrip days={weekData.days} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire Today page into routes in App.tsx**

Replace the Today placeholder:

```tsx
import Today from './pages/Today';
// ...
<Route index element={<Today />} />
```

- [ ] **Step 6: Verify in browser**

Start both backend and frontend, verify Today page renders (will show "no data" state until sync).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Today page with recovery/strain/sleep dashboard"
```

---

### Task 17: Remaining Pages (Sleep, Recovery, Strain, Workouts, Trends, Insights, Coach, Journal, Settings)

**Files:**
- Create: `frontend/src/pages/Sleep.tsx`
- Create: `frontend/src/pages/Recovery.tsx`
- Create: `frontend/src/pages/Strain.tsx`
- Create: `frontend/src/pages/Workouts.tsx`
- Create: `frontend/src/pages/Trends.tsx`
- Create: `frontend/src/pages/Insights.tsx`
- Create: `frontend/src/pages/Coach.tsx`
- Create: `frontend/src/pages/Journal.tsx`
- Create: `frontend/src/pages/Settings.tsx`
- Create: `frontend/src/pages/Onboarding.tsx`
- Create: `frontend/src/components/charts/SleepStagesChart.tsx`
- Create: `frontend/src/components/charts/TrendLine.tsx`
- Create: `frontend/src/components/charts/RecoveryGauge.tsx`
- Create: `frontend/src/components/charts/StrainGauge.tsx`
- Create: `frontend/src/components/charts/HRChart.tsx`

**Skill:** invoke `frontend-design:frontend-design` for each page. Reference the matching `noop/Strand/Screens/*.swift` file for layout.

This is a large task — implement each page one at a time. Each page follows the same pattern:
1. Read the corresponding NOOP Swift screen for layout reference
2. Invoke frontend-design skill
3. Create the chart components needed
4. Create the page
5. Wire into App.tsx routes
6. Verify in browser
7. Commit

Each page commit message: `feat: add [PageName] page`

Full code for each page is not repeated here — the implementing agent should:
- Use the NOOP screen as visual reference
- Hit the corresponding backend API endpoint
- Use shadcn/ui Card, Badge, Separator components
- Use recharts for charts (LineChart, BarChart, PieChart, RadialBarChart)
- Follow the dark theme color scheme established in Task 14
- Follow the component patterns established in Task 16

---

### Task 18: Onboarding Flow

**Files:**
- Create: `frontend/src/pages/Onboarding.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Onboarding page**

```tsx
// frontend/src/pages/Onboarding.tsx
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useApi } from '../hooks/useApi';

export default function Onboarding() {
  const { data: authStatus } = useApi<{ authenticated: boolean }>('/auth/status');
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  const handleConnect = () => {
    window.location.href = '/auth/login';
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetch('/sync/start', { method: 'POST' });
    setSyncing(false);
    setSyncDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <Card className="w-full max-w-md space-y-6 border-bg-tertiary bg-bg-secondary p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-accent">AirMG</h1>
          <p className="mt-2 text-text-secondary">Your health data. Your machine. Local-first.</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full ${authStatus?.authenticated ? 'bg-accent' : 'bg-bg-tertiary'} flex items-center justify-center text-sm`}>
              {authStatus?.authenticated ? '✓' : '1'}
            </div>
            <div className="flex-1">
              <div className="font-medium">Connect Google Health</div>
              <div className="text-sm text-text-secondary">OAuth login to access your Fitbit Air data</div>
            </div>
            {!authStatus?.authenticated && (
              <Button onClick={handleConnect} className="bg-accent text-black hover:bg-accent-light">
                Connect
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full ${syncDone ? 'bg-accent' : 'bg-bg-tertiary'} flex items-center justify-center text-sm`}>
              {syncDone ? '✓' : '2'}
            </div>
            <div className="flex-1">
              <div className="font-medium">Sync Data</div>
              <div className="text-sm text-text-secondary">Pull your health data (last 90 days)</div>
            </div>
            {authStatus?.authenticated && !syncDone && (
              <Button onClick={handleSync} disabled={syncing} className="bg-accent text-black hover:bg-accent-light">
                {syncing ? 'Syncing...' : 'Sync'}
              </Button>
            )}
          </div>
        </div>

        {syncDone && (
          <Button
            onClick={() => window.location.href = '/'}
            className="w-full bg-accent text-black hover:bg-accent-light"
          >
            Go to Dashboard
          </Button>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add onboarding route to App.tsx**

```tsx
import Onboarding from './pages/Onboarding';
// Add route:
<Route path="onboarding" element={<Onboarding />} />
```

- [ ] **Step 3: Verify in browser**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Onboarding.tsx frontend/src/App.tsx
git commit -m "feat: add onboarding flow with Google Health connect + sync"
```

---

## Phase 6: Polish + Integration

### Task 19: Lint + Format Everything

- [ ] **Step 1: Run ruff on backend**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run ruff check src/ tests/ --fix
uv run ruff format src/ tests/
```

- [ ] **Step 2: Run Biome on frontend**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npx biome check --write src/
```

- [ ] **Step 3: Run all backend tests**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run pytest -v
```
Expected: all PASSED

- [ ] **Step 4: Run TypeScript check**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: lint and format all code"
```

---

### Task 20: End-to-End Verification

- [ ] **Step 1: Start backend**

```bash
cd /Users/suryaprasad/projects/air_mg/backend
uv run airmg
```

- [ ] **Step 2: Start frontend**

```bash
cd /Users/suryaprasad/projects/air_mg/frontend
npm run dev
```

- [ ] **Step 3: Verify health check**

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

- [ ] **Step 4: Verify API docs**

Open http://localhost:8000/docs — FastAPI Swagger UI should list all endpoints.

- [ ] **Step 5: Verify frontend renders**

Open http://localhost:5173 — dark theme, sidebar nav, Today page.

- [ ] **Step 6: Navigate through all pages**

Click each nav item — verify no console errors, all pages render placeholder or data state.

- [ ] **Step 7: Test onboarding flow**

Navigate to http://localhost:5173/onboarding — verify connect + sync UI renders.

- [ ] **Step 8: Commit final state**

```bash
git add -A
git commit -m "feat: AirMG v0.1.0 — local-first Fitbit Air health dashboard"
```
