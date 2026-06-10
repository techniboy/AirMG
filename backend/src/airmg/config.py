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
