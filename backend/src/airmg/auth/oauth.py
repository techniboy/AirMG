from __future__ import annotations
from google_auth_oauthlib.flow import Flow
from airmg.config import CLIENT_SECRETS_PATH, GOOGLE_HEALTH_SCOPES, OAUTH_REDIRECT_URI

def create_flow() -> Flow:
    flow = Flow.from_client_secrets_file(
        str(CLIENT_SECRETS_PATH),
        scopes=GOOGLE_HEALTH_SCOPES,
        redirect_uri=OAUTH_REDIRECT_URI,
    )
    return flow

def get_authorization_url() -> tuple[str, str]:
    flow = create_flow()
    url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url, state

def exchange_code(code: str) -> dict:
    flow = create_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or []),
    }
