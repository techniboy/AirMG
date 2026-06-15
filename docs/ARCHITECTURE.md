# Architecture

AirMG is a two-process local app: a Python/FastAPI backend that owns data + analytics, and a
React/Vite frontend that renders it. Everything runs on `localhost`; the only outbound traffic is
the OAuth handshake and the read-only sync from Google Health.

```
Google Health API
      │  OAuth (auth/) + read-only sync (sync/)
      ▼
┌──────────────────────────────────────────────┐
│ backend  (FastAPI, 127.0.0.1:8000)            │
│                                               │
│  auth/      OAuth flow + token persistence    │
│  sync/      client → mapper → store           │
│  store/     SQLite (schema.sql, reads, writes)│
│  analytics/ recovery, strain, sleep, baselines│
│  routes/    one router per feature → /api/…   │
│  coach/     guidance engine                   │
│  journal/   tag catalog                       │
└───────────────┬───────────────────────────────┘
                │ JSON over HTTP (CORS: localhost:5173)
                ▼
┌──────────────────────────────────────────────┐
│ frontend (React 19 + Vite, localhost:5173)    │
│                                               │
│  api/        typed fetch layer                │
│  atoms/      Jotai state (incl. theme)        │
│  hooks/      data hooks (TanStack Query)      │
│  components/ shared chart + layout components │
│  pages/      12 routes, theme-agnostic        │
│  orbital/    WebGL data-city (three.js / R3F) │
│  radio/      neon "Radio City" DOM/SVG skin   │
└──────────────────────────────────────────────┘
```

## Backend (`backend/src/airmg/`)

Python 3.13, FastAPI, managed with `uv`. Entry point is `main.py` (`uv run airmg` → `airmg.main:run`).

| Module | Responsibility |
|---|---|
| `config.py` | Single source of paths/ports/scopes. Data dir `~/.airmg`, DB + token paths, Google Health base URL + scopes, `BACKEND_PORT=8000`, `FRONTEND_ORIGIN`, OAuth redirect URI. |
| `auth/` | `oauth.py` builds the authorization URL + exchanges the code; `tokens.py` persists/loads/clears credentials and answers `is_authenticated()`. |
| `sync/` | `client.py` calls Google Health; `mapper.py` maps responses into the local schema. |
| `store/` | `schema.sql` (DDL), `db.py` (`init_db`), `reads.py` / `writes.py`. SQLite at `~/.airmg/airmg.db`. |
| `analytics/` | The product: `recovery.py`, `strain.py`, `sleep_score.py`, `baselines.py` (personal rolling baselines), `zones.py` (HR zones), `health_age.py`, `behaviors.py`, and `pipeline.py` that orchestrates them. |
| `coach/` | `engine.py` — derives coaching guidance from the metrics. |
| `journal/` | `catalog.py` — journal tag catalog (behaviours you log against outcomes). |
| `routes/` | One router per feature, mounted in `main.py`: `auth`, `sync`, `dashboard`, `sleep`, `readiness`, `recovery`, `strain`, `workouts`, `trends`, `insights`, `coach`, `journal`, `settings`, `explorer`, `export`, `baselines`, `health_age`. |

### Request lifecycle

1. `lifespan` startup → `ensure_dirs()` + `init_db()`.
2. CORS middleware allows only `FRONTEND_ORIGIN`.
3. An **auth guard** middleware lets `/auth/*`, `/health`, `/docs`, `/openapi.json`, `/redoc`
   through unauthenticated; any `/api/*` or `/sync/*` request returns `401` unless
   `is_authenticated()`.
4. Feature routers handle the request, reading from the store / running analytics.

### Data model (SQLite)

- `samples` — typed time-series points (`type`, `ts`, `value`, `source`), unique on `(type, ts)`.
- `sleep_sessions` — per-night sessions with efficiency, staged JSON, resting HR, avg HRV.
- `workouts` — sessions with type, calories, avg/max HR, computed strain.
- `daily_metrics` — the daily rollup (recovery, strain, sleep performance, HRV, RHR, resp rate,
  SpO₂, skin temp, steps, calories), keyed by `day`.

`source` defaults to `google-health`, so additional providers can be added without schema changes.

## Frontend (`frontend/src/`)

React 19 + TypeScript + Vite. Data fetching via TanStack Query (`jotai-tanstack-query` bridges it to
Jotai atoms); client state via Jotai. Routing via React Router (`App.tsx`).

- **Pages are theme-agnostic.** Each page (Today, Sleep, Recovery, Strain, Workouts, Trends,
  Insights, Health Age, Coach, Journal, Settings, Onboarding) is a composition of shared chart
  components.
- **Theme is one atom.** `atoms/theme.ts` holds `"dark" | "liquid-glass" | "orbital" | "radio"`
  (persisted to `localStorage`). `components/layout/Shell.tsx` branches on it:
  - `orbital` → lazy-loads the WebGL scene in `orbital/` (three.js + React Three Fiber + `maath`).
  - `radio` → lazy-loads `radio/RadioShell` — a DOM/CSS/SVG neon skin with a time-of-day phase
    engine (`radio/phase.ts`, driven by `orbital/solarClock.ts`; honours `?timeFixture=`).
  - `dark` / `liquid-glass` → the standard shell.
- **Shared chart components** (`components/charts/`, `components/shared/`) render their normal form
  by default and a theme-specific form when a neon/orbital theme is active — so adding a page
  inherits every theme for free.

## Why this shape

- **Local-first:** the backend is the only thing that touches the network; the DB is a file you own.
- **Analytics is the moat, so it's isolated and tested** (`backend/tests/`, `analytics/` is pure
  functions over the store).
- **Presentation is swappable:** four themes over one data model proves the data layer is clean —
  the UI can be anything from a focused dashboard to a flythrough city.

See [SETUP.md](SETUP.md) to run it, and [../ATTRIBUTION.md](../ATTRIBUTION.md) for the NOOP lineage.
