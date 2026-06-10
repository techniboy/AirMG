# AirMG — Design Spec

A local-first health dashboard for Fitbit Air (and any Google Health device). Inspired by [NOOP](../../../noop/), ported from native Swift/Kotlin to Python + React webapp.

## Overview

AirMG pulls health data from Google Health API, processes it through NOOP-derived analytics engines in Python, and serves a dark-themed React dashboard on localhost. No cloud, no account — data stays on the user's machine.

```
Fitbit Air → Google Health API → FastAPI (localhost:8000) → SQLite → React UI (localhost:5173)
```

## Data Source: Google Health API

- **Endpoint**: `health.googleapis.com/v4/`
- **Auth**: Google OAuth 2.0, web client type, redirect to `localhost:8000/auth/callback`
- **Token storage**: local file (`~/.airmg/tokens.json`), auto-refresh
- **Data types to sync**:
  - Heart rate (continuous + resting)
  - Heart rate variability (RMSSD)
  - Sleep sessions (with stages if available)
  - Workouts/activities
  - Steps
  - SpO2
  - Respiratory rate
  - Skin temperature
  - Weight / body composition
- **Sync strategy**: initial full sync, then incremental (last-synced timestamp). Manual trigger from UI, no background polling.

## Backend: Python + FastAPI

### Tooling

- **Package manager**: `uv` (fast, replaces pip/venv)
- **Linter/formatter**: `ruff` (replaces black/isort/flake8)
- **Python version**: 3.13+
- **Framework**: FastAPI with uvicorn
- **Database**: SQLite via `sqlite3` stdlib (no ORM — direct SQL like NOOP's WhoopStore)
- **Testing**: pytest

### Project Structure

```
backend/
├── pyproject.toml          # uv project config
├── src/
│   └── airmg/
│       ├── __init__.py
│       ├── main.py             # FastAPI app, CORS, startup
│       ├── config.py           # paths, constants
│       ├── auth/
│       │   ├── oauth.py        # Google OAuth flow
│       │   └── tokens.py       # token storage/refresh
│       ├── sync/
│       │   ├── client.py       # Google Health API client
│       │   ├── mapper.py       # API response → internal models
│       │   └── scheduler.py    # sync state tracking
│       ├── store/
│       │   ├── db.py           # SQLite connection, migrations
│       │   ├── schema.sql      # table definitions
│       │   ├── reads.py        # query functions
│       │   └── writes.py       # insert/upsert functions
│       ├── analytics/
│       │   ├── recovery.py     # RecoveryScorer port
│       │   ├── strain.py       # StrainScorer port
│       │   ├── sleep.py        # SleepStager port
│       │   ├── hrv.py          # HRVAnalyzer port
│       │   ├── baselines.py    # Baselines (EWMA) port
│       │   ├── workouts.py     # WorkoutDetector port
│       │   ├── correlation.py  # CorrelationEngine port
│       │   ├── comparison.py   # ComparisonEngine port
│       │   └── zones.py        # HR zones (Edwards/Karvonen)
│       ├── coach/
│       │   └── engine.py       # Coach recommendations
│       ├── journal/
│       │   ├── catalog.py      # Journal question catalog
│       │   └── store.py        # Journal entry CRUD
│       └── routes/
│           ├── auth.py         # /auth/* endpoints
│           ├── sync.py         # /sync/* endpoints
│           ├── dashboard.py    # /api/today, /api/week
│           ├── sleep.py        # /api/sleep/*
│           ├── recovery.py     # /api/recovery/*
│           ├── strain.py       # /api/strain/*
│           ├── workouts.py     # /api/workouts/*
│           ├── trends.py       # /api/trends/*
│           ├── insights.py     # /api/insights/*
│           ├── coach.py        # /api/coach/*
│           ├── journal.py      # /api/journal/*
│           └── settings.py     # /api/settings/*
└── tests/
    ├── test_recovery.py
    ├── test_strain.py
    ├── test_sleep.py
    ├── test_hrv.py
    └── ...
```

### Database Schema

Mirrors NOOP's WhoopStore, adapted for Google Health data:

```sql
-- Raw biometric samples (HR, HRV, SpO2, resp, temp)
CREATE TABLE samples (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,          -- 'hr', 'hrv', 'spo2', 'resp', 'temp'
    ts INTEGER NOT NULL,        -- unix seconds
    value REAL NOT NULL,
    source TEXT DEFAULT 'google-health',
    UNIQUE(type, ts)
);

-- Sleep sessions
CREATE TABLE sleep_sessions (
    id INTEGER PRIMARY KEY,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    efficiency REAL,
    stages_json TEXT,           -- JSON array of {start, end, stage}
    resting_hr INTEGER,
    avg_hrv REAL,
    source TEXT DEFAULT 'google-health'
);

-- Workouts / activities
CREATE TABLE workouts (
    id INTEGER PRIMARY KEY,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    type TEXT,                  -- 'running', 'cycling', etc.
    calories REAL,
    avg_hr INTEGER,
    max_hr INTEGER,
    strain REAL,               -- computed
    source TEXT DEFAULT 'google-health'
);

-- Daily computed metrics (recovery, strain, sleep scores)
CREATE TABLE daily_metrics (
    day TEXT PRIMARY KEY,       -- 'yyyy-MM-dd'
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

-- Baselines (EWMA rolling averages)
CREATE TABLE baselines (
    metric TEXT PRIMARY KEY,    -- 'hrv', 'rhr', 'resp', 'sleep_perf'
    mean REAL NOT NULL,
    spread REAL NOT NULL,      -- EWMA absolute deviation
    n INTEGER NOT NULL,        -- sample count
    updated_at INTEGER
);

-- Journal entries
CREATE TABLE journal_entries (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    question_key TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at INTEGER
);

-- Steps (daily aggregates)
CREATE TABLE steps (
    day TEXT PRIMARY KEY,
    total INTEGER NOT NULL,
    source TEXT DEFAULT 'google-health'
);

-- Sync state
CREATE TABLE sync_state (
    data_type TEXT PRIMARY KEY,
    last_synced_ts INTEGER,
    last_token TEXT             -- pagination cursor
);

-- User profile / settings
CREATE TABLE profile (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

### Analytics Engines (Ported from NOOP Swift)

All engines ported from `noop/Packages/StrandAnalytics/Sources/StrandAnalytics/`.

#### RecoveryScorer (`recovery.py`)
- **Input**: HRV (RMSSD), resting HR, respiratory rate, sleep performance
- **Method**: z-score + logistic composite
- **Weights**: HRV 60%, RHR 20%, sleep 15%, resp 5%
- **Output**: 0–100 score, bands: red <34, yellow <67, green ≥67
- **Cold start**: needs MIN_NIGHTS_SEED valid nights before scoring; returns population mean (58) as fallback
- **Adaptation**: Google Health provides pre-computed HRV and resting HR — use directly instead of computing from raw R-R intervals

#### StrainScorer (`strain.py`)
- **Input**: HR samples over time, resting HR, age
- **Method**: Heart Rate Reserve (Karvonen) → %HRR → TRIMP (Edwards 5-zone) → logarithmic compression
- **Output**: 0–21 scale
- **Constants**: denominator 7201, min readings 600 (~10 min at 1 Hz)
- **Adaptation**: Google Health HR samples may be less frequent than 1 Hz. Interpolate or adjust sample duration accordingly.

#### SleepStager (`sleep.py`)
- **Input**: HR samples during sleep window, HRV
- **Output**: sleep sessions with {wake, light, deep, rem} stages, efficiency, resting HR, avg HRV
- **Method**: 30s epoch features → percentile-band classifier → median smoothing + physiology rules
- **Adaptation**: Google Health may already provide sleep stages. If available, use those directly. If only sleep duration provided, fall back to on-device staging from HR data.

#### HRVAnalyzer (`hrv.py`)
- **Input**: HRV readings over time
- **Output**: trends, baselines, morning readiness window analysis
- **Adaptation**: use Google Health HRV data directly

#### Baselines (`baselines.py`)
- **Method**: EWMA (exponentially weighted moving average) with absolute deviation for spread
- **Purpose**: personal baseline normalization for recovery scoring

#### WorkoutDetector (`workouts.py`)
- **Input**: HR patterns
- **Output**: auto-detected workout sessions
- **Adaptation**: Google Health provides explicit workout sessions — use those. Detector is fallback.

#### CorrelationEngine (`correlation.py`)
- **Input**: daily metrics + journal entries
- **Output**: behavior-metric correlations (e.g., "alcohol → lower HRV")

#### ComparisonEngine (`comparison.py`)
- **Input**: daily metrics over time ranges
- **Output**: period-over-period comparisons with deltas

### API Endpoints

All prefixed with `/api/`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | GET | Redirect to Google OAuth consent |
| `/auth/callback` | GET | Handle OAuth redirect, store token |
| `/auth/status` | GET | Check if authenticated |
| `/sync/start` | POST | Trigger data sync from Google Health |
| `/sync/status` | GET | Current sync progress |
| `/api/today` | GET | Today's dashboard (recovery, strain, sleep, HR) |
| `/api/week` | GET | Last 7 days summary |
| `/api/sleep/:day` | GET | Sleep detail for a day |
| `/api/recovery/:day` | GET | Recovery detail for a day |
| `/api/strain/:day` | GET | Strain detail + HR zones |
| `/api/workouts` | GET | Workout list (paginated) |
| `/api/workouts/:id` | GET | Workout detail |
| `/api/trends` | GET | Metric trends over time range |
| `/api/insights` | GET | Behavior correlations |
| `/api/coach` | GET | Current recommendations |
| `/api/journal` | GET/POST | Journal entries CRUD |
| `/api/journal/catalog` | GET | Available journal questions |
| `/api/settings` | GET/PUT | User profile + preferences |
| `/api/metrics/explorer` | GET | All available metrics catalog |
| `/api/export/csv` | GET | Export data as CSV |

## Frontend: Vite + React + TypeScript + Tailwind

### Tooling

- **Build**: Vite
- **Framework**: React 19+
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Linter/formatter**: Biome
- **Charts**: recharts
- **HTTP client**: native fetch (no axios)

### Project Structure

```
frontend/
├── package.json
├── biome.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   └── client.ts           # fetch wrapper for localhost:8000
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── charts/
│   │   │   ├── HRChart.tsx
│   │   │   ├── SleepStagesChart.tsx
│   │   │   ├── StrainGauge.tsx
│   │   │   ├── RecoveryGauge.tsx
│   │   │   ├── TrendLine.tsx
│   │   │   └── WeekStrip.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Shell.tsx
│   │   └── shared/
│   │       ├── MetricCard.tsx
│   │       ├── ScoreBadge.tsx
│   │       └── DeltaIndicator.tsx
│   ├── pages/
│   │   ├── Today.tsx
│   │   ├── Sleep.tsx
│   │   ├── Recovery.tsx
│   │   ├── Strain.tsx
│   │   ├── Workouts.tsx
│   │   ├── Trends.tsx
│   │   ├── Insights.tsx
│   │   ├── Coach.tsx
│   │   ├── Journal.tsx
│   │   ├── Settings.tsx
│   │   └── Onboarding.tsx
│   ├── hooks/
│   │   ├── useApi.ts
│   │   ├── useToday.ts
│   │   └── useTrends.ts
│   └── lib/
│       ├── colors.ts            # NOOP-inspired color palette
│       ├── format.ts            # metric formatting
│       └── types.ts             # shared types
└── public/
```

### Design Direction

- **Dark theme** — NOOP-inspired, data-dense
- **Color palette**: dark grays (#0a0a0a, #1a1a1a, #2a2a2a), green accents (#18C98B / #2FE6A8 from NOOP)
- **Recovery bands**: red (#FF4444), yellow (#FFBB33), green (#18C98B)
- **Typography**: system mono/sans stack
- **Layout**: sidebar nav (collapsed on mobile) + main content area
- **Responsive**: desktop-first, usable on mobile browsers
- **Reference**: port visual patterns from `noop/Packages/StrandDesign/` and `noop/Strand/Screens/`

### Pages (mirroring NOOP screens)

1. **Today** — hero recovery score, strain gauge, sleep summary, HR sparkline, week strip
2. **Sleep** — sleep stages timeline, efficiency %, duration, resting HR during sleep, HRV
3. **Recovery** — recovery score detail, contributing factors breakdown, trend
4. **Strain** — strain gauge, HR zones breakdown, activity log, daily strain trend
5. **Workouts** — workout list, detail view with HR chart + zones + strain
6. **Trends** — metric explorer, time-range selectable charts for any metric
7. **Insights** — behavior correlations, journal-metric analysis
8. **Coach** — rule-based recommendations: recovery-based training load guidance (red=rest, yellow=moderate, green=push), sleep debt alerts, strain target based on recovery, hydration/rest reminders. No LLM — deterministic rules from recovery+strain+sleep state.
9. **Journal** — daily logging (alcohol, caffeine, stress, etc.), question catalog
10. **Settings** — profile (age, weight, sex for HR zones), units, data export, auth management
11. **Onboarding** — first-run: Google auth connect, profile setup

## Key Adaptations from NOOP

| Aspect | NOOP (WHOOP) | AirMG (Fitbit Air) |
|--------|-------------|-------------------|
| HR data | Raw 1 Hz from BLE | Google Health samples (variable frequency) |
| HRV | Computed from R-R intervals | Pre-computed RMSSD from Google Health |
| Sleep stages | Computed from HR + accel | Use Google Health stages if available, else compute from HR |
| Workouts | Auto-detected from HR | Use Google Health sessions + optional auto-detect |
| Recovery scoring | Full z-score composite | Same algorithm, adapted inputs |
| Strain scoring | 1 Hz HR → TRIMP | Variable-rate HR → TRIMP (interpolate) |
| Data source | BLE direct | Google Health REST API |
| Storage | SQLite (WhoopStore) | SQLite (direct SQL) |

## Scoring Transparency

All scores clearly labeled as approximations:
- "Recovery score is an estimate based on HRV, resting HR, and sleep data"
- "Strain is calculated using published exercise physiology methods (Edwards TRIMP)"
- Not medical advice disclaimers

## Running AirMG

```bash
# Backend
cd backend
uv sync
uv run airmg

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Backend starts on `localhost:8000`, frontend on `localhost:5173`.

## Agent Skill Guidelines

When implementing AirMG, agents should invoke these skills:

### Python Backend
- **`modern-python`** — uv project setup, pyproject.toml, Python 3.13+ patterns
- **`ruff`** — linting and formatting all Python files
- **`fastapi-python`** — FastAPI route patterns, dependency injection, middleware
- **`sqlite-database-expert`** — schema design, migrations, query optimization
- **`superpowers:test-driven-development`** — write tests before implementation for analytics engines

### Frontend
- **`tailwind-v4-shadcn`** — Tailwind v4 config, shadcn/ui component usage
- **`vercel-plugin:shadcn`** — shadcn CLI, component installation, theming
- **`vercel-plugin:react-best-practices`** — after editing TSX components
- **`frontend-design:frontend-design`** — when building page layouts and visual components

### Process
- **`superpowers:writing-plans`** — break spec into implementation phases
- **`superpowers:subagent-driven-development`** — parallelize independent tasks (e.g., backend analytics + frontend pages)
- **`superpowers:verification-before-completion`** — verify features work end-to-end
- **`superpowers:systematic-debugging`** — when debugging data flow or scoring issues
- **`code-review`** — review diffs before committing

## Out of Scope for V1

- Mobile native apps
- Cloud sync / multi-device
- Real-time streaming (pull-based sync only)
- Apple Health integration (future)
- Multiple device support (one Google account)
- PWA / offline mode
