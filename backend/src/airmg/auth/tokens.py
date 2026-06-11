from __future__ import annotations

import json

from airmg.config import TOKENS_PATH


def save_credentials(creds_data: dict) -> None:
    TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKENS_PATH.write_text(json.dumps(creds_data, indent=2))


def load_credentials() -> dict | None:
    if not TOKENS_PATH.exists():
        return None
    return json.loads(TOKENS_PATH.read_text())


def clear_credentials() -> None:
    if TOKENS_PATH.exists():
        TOKENS_PATH.unlink()


def is_authenticated() -> bool:
    creds = load_credentials()
    return creds is not None and "token" in creds
