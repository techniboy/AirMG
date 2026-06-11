from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from airmg.auth.oauth import exchange_code, get_authorization_url
from airmg.auth.tokens import clear_credentials, is_authenticated, save_credentials

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
def login():
    url, _state = get_authorization_url()
    return RedirectResponse(url)


@router.get("/callback")
def callback(code: str, state: str | None = None):
    creds_data = exchange_code(code, state)
    save_credentials(creds_data)
    return RedirectResponse("http://localhost:5173?auth=success")


@router.get("/status")
def auth_status():
    return {"authenticated": is_authenticated()}


@router.post("/logout")
def logout():
    clear_credentials()
    return {"status": "logged_out"}
