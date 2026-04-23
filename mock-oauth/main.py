"""
Mock OAuth Service for local development.

Simulates a real enterprise OAuth service with two endpoints:
  - GET/POST /api/v1/oauth/sso/authentication
  - POST   /api/v1/oauth/sso/userinfo

Usage:
  uvicorn main:app --host 0.0.0.0 --port 5557
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

app = FastAPI(title="Mock OAuth Service")

# ─── Configuration ───────────────────────────────────────────────────────────

CLIENT_ID = os.getenv("MOCK_OAUTH_CLIENT_ID", "migration-hub")
CLIENT_SECRET = os.getenv("MOCK_OAUTH_CLIENT_SECRET", "mock-secret-do-not-use-in-production")
PORT = int(os.getenv("MOCK_OAUTH_PORT", "5557"))

# In-memory code store: code -> {user, expires_at}
_code_store: dict[str, dict] = {}

# ─── Mock Users ──────────────────────────────────────────────────────────────

MOCK_USERS = {
    "u-current": {
        "id": "u-current",
        "email": "henry.wilson@corp.com",
        "name": "Henry Wilson",
    },
    "u3": {
        "id": "u3",
        "email": "alice.johnson@corp.com",
        "name": "Alice Johnson",
    },
    "u12": {
        "id": "u12",
        "email": "karen.lee@corp.com",
        "name": "Karen Lee",
    },
    "u2": {
        "id": "u2",
        "email": "dan.brown@corp.com",
        "name": "Dan Brown",
    },
    "u100": {
        "id": "u100",
        "email": "lance.chen@corp.com",
        "name": "Lance Chen",
    },
}


# ─── HTML Login Form ─────────────────────────────────────────────────────────

LOGIN_HTML = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mock OAuth Service</title>
  <style>
    body {{ font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }}
    .card {{ background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 320px; }}
    h1 {{ margin-top: 0; font-size: 1.25rem; }}
    label {{ display: block; margin-bottom: 0.5rem; font-weight: 500; }}
    select {{ width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 4px; }}
    button {{ width: 100%; padding: 0.6rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }}
    button:hover {{ background: #1d4ed8; }}
    .subtitle {{ color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Mock OAuth Service</h1>
    <p class="subtitle">Select a user to simulate enterprise SSO login.</p>
    <form method="post">
      <input type="hidden" name="redirect_uri" value="{redirect_uri}">
      <input type="hidden" name="state" value="{state}">
      <label for="user">User</label>
      <select id="user" name="user" required>
{options}
      </select>
      <button type="submit">Authenticate</button>
    </form>
  </div>
</body>
</html>
"""


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/v1/oauth/sso/authentication", response_class=HTMLResponse)
def authentication_get(
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    state: str = Query(...),
):
    if client_id != CLIENT_ID:
        raise HTTPException(status_code=400, detail="Invalid client_id")
    options_html = "\n".join(
        f'        <option value="{key}">{user["name"]}</option>'
        for key, user in MOCK_USERS.items()
    )
    return HTMLResponse(
        content=LOGIN_HTML.format(
            redirect_uri=redirect_uri, state=state, options=options_html
        ),
        status_code=200,
    )


@app.post("/api/v1/oauth/sso/authentication")
def authentication_post(
    user: str = Form(...),
    redirect_uri: str = Form(...),
    state: str = Form(...),
):
    if user not in MOCK_USERS:
        raise HTTPException(status_code=400, detail="Invalid user selection")

    code = str(uuid.uuid4())
    _code_store[code] = {
        "user": MOCK_USERS[user],
        "expires_at": datetime.utcnow() + timedelta(minutes=5),
    }

    redirect_url = f"{redirect_uri}?code={code}&state={state}"
    return RedirectResponse(url=redirect_url, status_code=302)


class UserInfoRequest(BaseModel):
    client_id: str
    client_secret: str
    code: str


@app.post("/api/v1/oauth/sso/userinfo")
def userinfo(body: UserInfoRequest):
    if body.client_id != CLIENT_ID or body.client_secret != CLIENT_SECRET:
        raise HTTPException(status_code=401, detail="Invalid client credentials")

    entry = _code_store.pop(body.code, None)
    if not entry:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if datetime.utcnow() > entry["expires_at"]:
        raise HTTPException(status_code=400, detail="Code expired")

    return entry["user"]


@app.get("/health")
def health():
    return {"status": "ok"}
