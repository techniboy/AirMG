# Setup guide

This walks you from a fresh clone to a running AirMG with your own Google Health data. ~15 minutes,
most of which is the one-time Google Cloud OAuth setup.

> **Privacy note up front:** everything AirMG stores lives under `~/.airmg/` on your machine. Your
> OAuth `client_secret.json` and the resulting `tokens.json` are gitignored and never committed.

---

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.13+ | [python.org](https://www.python.org/) |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh | sh` ([docs](https://docs.astral.sh/uv/)) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |

A Google account with health data in **Google Health** is required for real data.

---

## 2. Google Cloud OAuth client

AirMG reads your data through the Google Health API using OAuth. You need your own OAuth client.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create (or pick) a project.
2. **APIs & Services → Enable APIs** → enable the **Google Health API**.
3. **APIs & Services → OAuth consent screen** → configure it:
   - User type **External** is fine for personal use; keep publishing status **Testing**.
   - On the **Scopes** step, **Add scopes** → add the four read-only Google Health scopes:
     ```
     https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
     https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
     https://www.googleapis.com/auth/googlehealth.sleep.readonly
     https://www.googleapis.com/auth/googlehealth.profile.readonly
     ```
     (These must match `GOOGLE_HEALTH_SCOPES` in `backend/src/airmg/config.py`.)
   - On the **Test users** step, add **your own Google account**. No app verification is needed while in Testing.
4. **Credentials → Create credentials → OAuth client ID → Application type: Web application**.
   - Under **Authorized redirect URIs**, add exactly: `http://localhost:8000/auth/callback`
   - (No "Authorized JavaScript origins" needed — the OAuth flow is server-side.)
5. **Download JSON** for that client and save it to the repo root as **`client_secret.json`**:
   ```
   air_mg/client_secret.json
   ```
   This path is read by `backend/src/airmg/config.py` (`CLIENT_SECRETS_PATH`) and is gitignored — never commit it.

> **Testing-mode note:** while the consent screen stays in **Testing**, Google-issued refresh
> tokens expire after 7 days. If a sync suddenly returns `401`, just re-connect (Section 5) to
> mint fresh tokens. Publishing the app removes this limit but isn't needed for personal use.

> Ports and the redirect URI are defined in `backend/src/airmg/config.py`. If you change
> `BACKEND_PORT` or `FRONTEND_ORIGIN`, update the redirect URI in Google Cloud to match.

---

## 3. Backend

```bash
cd backend
uv sync          # creates .venv and installs deps from uv.lock
uv run airmg     # starts uvicorn on http://127.0.0.1:8000 (reload on)
```

Verify:

```bash
curl http://127.0.0.1:8000/health          # → {"status":"ok"}
open http://127.0.0.1:8000/docs             # interactive API docs
```

On first start the backend creates `~/.airmg/` and initialises `~/.airmg/airmg.db`.

---

## 4. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev      # Vite on http://localhost:5173
```

---

## 5. Connect & sync

1. Open **http://localhost:5173**.
2. Go through onboarding / click **Connect** — this redirects to `GET /auth/login`, which sends you
   to Google's consent screen.
3. Approve. Google redirects back to `/auth/callback`, AirMG stores credentials in
   `~/.airmg/tokens.json`, and bounces you to the app with `?auth=success`.
4. Trigger a **sync** (Settings, or the sync action on first load). AirMG pulls your Google Health
   data read-only, maps it into the local schema, and runs the analytics pipeline.
5. Open **Today** — you should see your recovery, strain and sleep numbers.

Check auth state any time:

```bash
curl http://127.0.0.1:8000/auth/status      # → {"authenticated": true|false}
```

---

## 6. Running tests / lint

```bash
# backend
cd backend
uv run pytest
uv run ruff check .

# frontend
cd frontend
npm test          # vitest
npm run lint      # eslint
npm run build     # tsc -b && vite build
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 Not authenticated` on `/api/*` | You haven't completed OAuth, or `tokens.json` was cleared. Re-connect. The auth guard in `main.py` only allows `/auth/*`, `/health`, `/docs` through unauthenticated. |
| OAuth `redirect_uri_mismatch` | The redirect URI in Google Cloud must exactly equal `http://localhost:8000/auth/callback`. |
| `403 access_denied` on consent | Add your Google account as a **Test user** on the OAuth consent screen. |
| `client_secret.json` not found | It must sit in the **repo root**, not in `backend/`. See `CLIENT_SECRETS_PATH` in `config.py`. |
| CORS errors in browser | Frontend must run on `http://localhost:5173` (the `FRONTEND_ORIGIN` allowed by the backend). |
| Want a clean slate | Delete `~/.airmg/` (drops the local DB and tokens) and re-sync. |

---

## Where your data lives

```
~/.airmg/
├── airmg.db        # all synced samples, sleep sessions, workouts, daily metrics (SQLite)
└── tokens.json     # your Google OAuth tokens

air_mg/             # the repo
└── client_secret.json   # your OAuth client (gitignored)
```

Nothing else leaves your machine.
