from __future__ import annotations

import time

import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from airmg.auth.tokens import load_credentials, save_credentials
from airmg.config import GOOGLE_HEALTH_BASE


def _get_credentials() -> Credentials:
    creds_data = load_credentials()
    if creds_data is None:
        raise RuntimeError("Not authenticated. Connect Google Health first.")

    expires_at = creds_data.get("expires_at", 0)
    token_expired = time.time() >= expires_at - 60

    if token_expired and creds_data.get("refresh_token"):
        creds = Credentials(
            token=creds_data["token"],
            refresh_token=creds_data["refresh_token"],
            token_uri=creds_data.get("token_uri"),
            client_id=creds_data.get("client_id"),
            client_secret=creds_data.get("client_secret"),
        )
        creds.refresh(Request())
        creds_data = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or []),
            "expires_at": time.time() + 3600,
        }
        save_credentials(creds_data)

    return Credentials(
        token=creds_data["token"],
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data.get("token_uri"),
        client_id=creds_data.get("client_id"),
        client_secret=creds_data.get("client_secret"),
    )


def fetch_data_points(
    data_type: str,
    start_iso: str | None = None,
    end_iso: str | None = None,
    filter_field: str | None = None,
) -> list[dict]:
    creds = _get_credentials()
    url = f"{GOOGLE_HEALTH_BASE}/users/me/dataTypes/{data_type}/dataPoints"
    headers = {"Authorization": f"Bearer {creds.token}"}
    params: dict[str, str] = {"pageSize": "1000"}
    if filter_field and start_iso and end_iso:
        params["filter"] = f'{filter_field} >= "{start_iso}" AND {filter_field} < "{end_iso}"'
    all_points: list[dict] = []
    with httpx.Client() as client:
        while True:
            resp = client.get(url, headers=headers, params=params, timeout=30)
            if resp.status_code >= 400:
                raise RuntimeError(f"{resp.status_code}: {resp.text}")
            data = resp.json()
            all_points.extend(data.get("dataPoints", []))
            next_token = data.get("nextPageToken")
            if not next_token:
                break
            params["pageToken"] = next_token
    return all_points
