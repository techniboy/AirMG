from __future__ import annotations

import hashlib
import json
import os
from base64 import urlsafe_b64encode

os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

from google_auth_oauthlib.flow import Flow

from airmg.config import (
    CLIENT_SECRETS_PATH,
    DATA_DIR,
    GOOGLE_HEALTH_SCOPES,
    OAUTH_REDIRECT_URI,
)

_VERIFIER_PATH = DATA_DIR / "pkce_verifier.json"


def _create_flow() -> Flow:
    return Flow.from_client_secrets_file(
        str(CLIENT_SECRETS_PATH),
        scopes=GOOGLE_HEALTH_SCOPES,
        redirect_uri=OAUTH_REDIRECT_URI,
    )


def _generate_pkce() -> tuple[str, str]:
    verifier = urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    challenge = (
        urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )
    return verifier, challenge


def get_authorization_url() -> tuple[str, str]:
    flow = _create_flow()
    verifier, challenge = _generate_pkce()
    url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        code_challenge=challenge,
        code_challenge_method="S256",
    )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _VERIFIER_PATH.write_text(json.dumps({"code_verifier": verifier}))
    return url, state


def exchange_code(code: str, state: str | None = None) -> dict:
    import httpx

    flow = _create_flow()
    client_cfg = flow.client_config
    verifier = None
    if _VERIFIER_PATH.exists():
        saved = json.loads(_VERIFIER_PATH.read_text())
        verifier = saved.get("code_verifier")
        _VERIFIER_PATH.unlink(missing_ok=True)
    body = {
        "code": code,
        "client_id": client_cfg["client_id"],
        "client_secret": client_cfg["client_secret"],
        "redirect_uri": OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    if verifier:
        body["code_verifier"] = verifier
    resp = httpx.post(client_cfg["token_uri"], data=body, timeout=30)
    resp.raise_for_status()
    tokens = resp.json()
    return {
        "token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token"),
        "token_uri": client_cfg["token_uri"],
        "client_id": client_cfg["client_id"],
        "client_secret": client_cfg["client_secret"],
        "scopes": tokens.get("scope", "").split(),
    }
