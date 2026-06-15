"""Smoke test: every GET route is wired to the get_db dependency and doesn't
500 on an empty database. Guards the Depends(get_db) conversion."""

from __future__ import annotations

from fastapi.testclient import TestClient

import airmg.main as main_mod
from airmg.main import app
from airmg.store.db import get_connection, get_db, init_db

GET_ROUTES = [
    "/api/today",
    "/api/week",
    "/api/sparklines",
    "/api/baselines",
    "/api/coach",
    "/api/readiness",
    "/api/health-age",
    "/api/recovery/2026-06-10",
    "/api/strain/2026-06-10",
    "/api/sleep/2026-06-10",
    "/api/journal?day=2026-06-10",
    "/api/trends?start=2026-06-01&end=2026-06-10",
    "/api/workouts?start=2026-06-01&end=2026-06-10",
    "/api/export/csv?start=2026-06-01&end=2026-06-10",
    "/api/settings",
]


def test_get_routes_wired(tmp_path, monkeypatch):
    db = tmp_path / "smoke.db"
    init_db(db)

    def override_db():
        conn = get_connection(db)
        try:
            yield conn
        finally:
            conn.close()

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(main_mod, "is_authenticated", lambda: True)
    client = TestClient(app)
    try:
        assert client.get("/health").status_code == 200
        for url in GET_ROUTES:
            r = client.get(url)
            # <500 proves the route + get_db dependency are wired (no NameError /
            # unclosed-conn crash); empty DB legitimately yields 200 no_data shapes.
            assert r.status_code < 500, (url, r.status_code, r.text)
    finally:
        app.dependency_overrides.clear()
