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
