# AirMG backend

FastAPI service that owns AirMG's data and analytics. It handles Google Health OAuth, syncs your
data read-only into a local SQLite database, runs the recovery/strain/sleep/health-age engine, and
serves it as JSON to the frontend.

Part of [AirMG](../README.md) — see the [root README](../README.md) and
[architecture doc](../docs/ARCHITECTURE.md) for the full picture.

## Stack

Python 3.13 · FastAPI · Uvicorn · httpx · google-auth · SQLite. Managed with [`uv`](https://docs.astral.sh/uv/).

## Run

```bash
uv sync          # install deps from uv.lock into .venv
uv run airmg     # uvicorn on http://127.0.0.1:8000 (reload)
```

Requires `client_secret.json` in the **repo root** (one level up) — see
[docs/SETUP.md](../docs/SETUP.md) for the Google Cloud OAuth setup. On first start it creates
`~/.airmg/` and initialises `~/.airmg/airmg.db`.

## Tests & lint

```bash
uv run pytest
uv run ruff check .
```

## Layout (`src/airmg/`)

| Path | What |
|---|---|
| `main.py` | App factory, router mounting, CORS, auth-guard middleware, `run()` entry point. |
| `config.py` | Paths, ports, Google Health base URL + scopes, OAuth redirect URI. |
| `auth/` | OAuth flow (`oauth.py`) + token persistence (`tokens.py`). |
| `sync/` | Google Health client (`client.py`) + response→schema mapper (`mapper.py`). |
| `store/` | `schema.sql`, `db.py`, `reads.py`, `writes.py` — the SQLite layer. |
| `analytics/` | recovery, strain, sleep score, baselines, zones, health age, behaviours, pipeline. |
| `coach/`, `journal/` | Coaching engine and journal tag catalog. |
| `routes/` | One router per feature, all mounted in `main.py`. |

## Key endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness — `{"status":"ok"}`. Open (no auth). |
| `GET /auth/login` | Redirect to Google consent. |
| `GET /auth/callback` | OAuth callback; stores tokens, redirects to the app. |
| `GET /auth/status` | `{"authenticated": bool}`. |
| `POST /auth/logout` | Clears stored credentials. |
| `/api/*`, `/sync/*` | Feature + sync endpoints. **Require auth** (else `401`). |
| `GET /docs` | Interactive OpenAPI docs. |

The auth guard in `main.py` lets `/auth/*`, `/health`, `/docs`, `/openapi.json`, `/redoc` through
unauthenticated; everything under `/api/*` and `/sync/*` needs valid credentials.
