# backend/src/airmg/main.py
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from airmg.config import BACKEND_PORT, DB_PATH, FRONTEND_ORIGIN, ensure_dirs
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


@app.get("/health")
def health_check():
    return {"status": "ok"}


def run():
    uvicorn.run("airmg.main:app", host="127.0.0.1", port=BACKEND_PORT, reload=True)
