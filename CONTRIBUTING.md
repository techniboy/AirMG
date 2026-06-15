# Contributing to AirMG

Thanks for your interest. AirMG is a local-first health dashboard; contributions of all sizes are
welcome — bug fixes, new analytics, theme work, docs.

## Ground rules

- **Not a medical device.** AirMG's metrics are approximations and are not clinically validated.
  Don't add claims, copy, or features that imply medical/diagnostic use.
- **Local-first is the point.** Don't add cloud dependencies, telemetry, analytics SDKs, or anything
  that sends user data off-machine. The only outbound calls are the Google OAuth handshake and the
  read-only Google Health sync.
- **Never commit secrets.** `client_secret.json`, `tokens.json`, `pkce_verifier.json`, `*.db` and
  `.env` are gitignored — keep it that way.

## Getting set up

Follow **[docs/SETUP.md](docs/SETUP.md)**. TL;DR: `uv sync && uv run airmg` for the backend,
`npm install && npm run dev` for the frontend.

## Before you open a PR

Run the checks for whatever you touched:

```bash
# backend
cd backend && uv run pytest && uv run ruff check .

# frontend
cd frontend && npm test && npm run lint && npm run build
```

- New analytics or data-pipeline logic should come with a test in `backend/tests/`.
- Match the surrounding style — `ruff` (line length 100, rules in `pyproject.toml`) for Python,
  ESLint for TS. Don't reformat unrelated files.
- Keep diffs focused; one concern per PR.

## Architecture

Read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** first. Quick map:

- Backend feature = a router in `backend/src/airmg/routes/` + (usually) a function in
  `backend/src/airmg/analytics/`. Pages read it via the typed API layer in `frontend/src/api/`.
- Frontend pages are theme-agnostic compositions of shared chart components. If you add a chart,
  make it render sensibly across all four themes (see how existing `components/charts/` components
  branch on the active theme).

## Licensing of contributions

By contributing you agree your contributions are licensed under the project's
[Apache License 2.0](LICENSE).

## Reporting bugs

Open a GitHub issue with: what you did, what you expected, what happened, and your OS / Python / Node
versions. For sync issues, the relevant backend log lines help (with any personal data redacted).
