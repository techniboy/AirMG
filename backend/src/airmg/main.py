# backend/src/airmg/main.py
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from airmg.auth.tokens import is_authenticated
from airmg.config import BACKEND_PORT, DB_PATH, FRONTEND_ORIGIN, ensure_dirs
from airmg.routes.auth import router as auth_router
from airmg.routes.coach import router as coach_router
from airmg.routes.dashboard import router as dashboard_router
from airmg.routes.explorer import router as explorer_router
from airmg.routes.health_age import router as health_age_router
from airmg.routes.export import router as export_router
from airmg.routes.insights import router as insights_router
from airmg.routes.journal import router as journal_router
from airmg.routes.readiness import router as readiness_router
from airmg.routes.recovery import router as recovery_router
from airmg.routes.settings import router as settings_router
from airmg.routes.sleep import router as sleep_router
from airmg.routes.strain import router as strain_router
from airmg.routes.sync import router as sync_router
from airmg.routes.trends import router as trends_router
from airmg.routes.workouts import router as workouts_router
from airmg.routes.baselines_route import router as baselines_router
from airmg.store.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    init_db(DB_PATH)
    yield


app = FastAPI(title="AirMG", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_guard(request: Request, call_next):
    path = request.url.path
    open_paths = ("/auth/", "/health", "/docs", "/openapi.json", "/redoc")
    if any(path.startswith(p) for p in open_paths):
        return await call_next(request)
    if path.startswith(("/api/", "/sync/")) and not is_authenticated():
        return JSONResponse({"detail": "Not authenticated"}, status_code=401)
    return await call_next(request)

app.include_router(auth_router)
app.include_router(sync_router)
app.include_router(dashboard_router)
app.include_router(sleep_router)
app.include_router(readiness_router)
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
app.include_router(baselines_router)
app.include_router(health_age_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


def run():
    uvicorn.run("airmg.main:app", host="127.0.0.1", port=BACKEND_PORT, reload=True)
