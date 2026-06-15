from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path.home() / ".airmg"
DB_PATH = DATA_DIR / "airmg.db"
TOKENS_PATH = DATA_DIR / "tokens.json"
CLIENT_SECRETS_PATH = REPO_ROOT / "client_secret.json"

GOOGLE_HEALTH_BASE = "https://health.googleapis.com/v4"
GOOGLE_HEALTH_SCOPES = [
    "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
    "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
    "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
    "https://www.googleapis.com/auth/googlehealth.profile.readonly",
]

BACKEND_PORT = 8000
FRONTEND_ORIGIN = "http://localhost:5173"
OAUTH_REDIRECT_URI = f"http://localhost:{BACKEND_PORT}/auth/callback"


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
