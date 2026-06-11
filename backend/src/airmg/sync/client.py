from __future__ import annotations
import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from airmg.auth.tokens import load_credentials, save_credentials
from airmg.config import GOOGLE_HEALTH_BASE

def _get_credentials() -> Credentials:
    creds_data = load_credentials()
    if creds_data is None:
        raise RuntimeError("Not authenticated. Connect Google Health first.")
    creds = Credentials(
        token=creds_data["token"],
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data.get("token_uri"),
        client_id=creds_data.get("client_id"),
        client_secret=creds_data.get("client_secret"),
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        save_credentials({
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or []),
        })
    return creds

def fetch_data_points(data_type: str, start_ts: int, end_ts: int) -> list[dict]:
    creds = _get_credentials()
    url = f"{GOOGLE_HEALTH_BASE}/users/me/dataTypes/{data_type}/dataPoints"
    headers = {"Authorization": f"Bearer {creds.token}"}
    params = {
        "startTime": f"{start_ts}s",
        "endTime": f"{end_ts}s",
    }
    all_points: list[dict] = []
    with httpx.Client() as client:
        while True:
            resp = client.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            all_points.extend(data.get("dataPoints", []))
            next_token = data.get("nextPageToken")
            if not next_token:
                break
            params["pageToken"] = next_token
    return all_points
