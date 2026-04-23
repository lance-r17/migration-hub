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


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _derive_initials(name: str) -> str:
    """Derive initials from a full name (first letter of each word, uppercased)."""
    return "".join(part[0].upper() for part in name.split() if part)


# ─── HTML Login Form ─────────────────────────────────────────────────────────

LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mock OAuth Service — Migration Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --background: hsl(44, 42.86%, 93.14%);
      --foreground: hsl(28.57, 16.54%, 24.90%);
      --card: hsl(42, 100%, 98.04%);
      --card-foreground: hsl(28.57, 16.54%, 24.90%);
      --primary: hsl(30, 33.87%, 48.63%);
      --primary-foreground: hsl(0, 0%, 100%);
      --muted-foreground: hsl(32.31, 18.48%, 41.37%);
      --border: hsl(40, 31.43%, 79.41%);
      --input: hsl(40, 31.43%, 79.41%);
      --ring: hsl(30, 33.87%, 48.63%);
      --radius-lg: 0.75rem;
      --radius-md: 0.5rem;
      --shadow-xl: 2px 3px 5px 0px hsl(28 13% 20% / 0.12), 2px 8px 10px -1px hsl(28 13% 20% / 0.12);
    }
    .dark {
      --background: hsl(25, 15.38%, 15.29%);
      --foreground: hsl(39, 34.48%, 88.63%);
      --card: hsl(25.71, 13.73%, 20%);
      --card-foreground: hsl(39, 34.48%, 88.63%);
      --primary: hsl(30, 33.68%, 62.75%);
      --primary-foreground: hsl(25, 15.38%, 15.29%);
      --muted-foreground: hsl(38.4, 17.73%, 72.35%);
      --border: hsl(24.71, 12.98%, 25.69%);
      --input: hsl(24.71, 12.98%, 25.69%);
      --ring: hsl(30, 33.68%, 62.75%);
      --shadow-xl: 2px 3px 5px 0px hsl(28 13% 20% / 0.25), 2px 8px 10px -1px hsl(28 13% 20% / 0.25);
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: 'Montserrat', ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: var(--background);
      color: var(--foreground);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .page {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 1.5rem;
    }
    @media (min-width: 768px) {
      .page { padding: 2.5rem; }
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
      color: var(--foreground);
      text-decoration: none;
      justify-content: center;
      font-size: 0.875rem;
      line-height: 1.25rem;
    }
    @media (min-width: 768px) {
      .brand { justify-content: flex-start; }
    }
    .brand img {
      width: 1.5rem;
      height: 1.5rem;
      flex-shrink: 0;
    }
    .main {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
    }
    .card {
      width: 100%;
      max-width: 20rem;
      background: var(--card);
      color: var(--card-foreground);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl), 0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .card-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      text-align: center;
      align-items: center;
    }
    .card-title {
      font-size: 1.25rem;
      line-height: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .card-description {
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: var(--muted-foreground);
      text-wrap: balance;
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .label {
      font-size: 0.875rem;
      line-height: 1.25rem;
      font-weight: 500;
    }
    .select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      width: 100%;
      height: 2rem;
      padding: 0 2rem 0 0.625rem;
      font-family: inherit;
      font-size: 0.875rem;
      color: var(--foreground);
      background-color: transparent;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237a6b5a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.5rem center;
      border: 1px solid var(--input);
      border-radius: var(--radius-md);
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
    }
    .dark .select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23c4b8a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    }
    .select:focus {
      border-color: var(--ring);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      width: 100%;
      height: 2rem;
      padding: 0 0.625rem;
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.05s ease;
      outline: none;
    }
    .btn-primary {
      background: var(--primary);
      color: var(--primary-foreground);
    }
    .btn-primary:hover {
      background: color-mix(in srgb, var(--primary) 80%, transparent);
    }
    .btn-primary:active {
      transform: translateY(1px);
    }
    .btn-primary:focus-visible {
      border-color: var(--ring);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent);
    }
    .footer {
      font-size: 0.75rem;
      line-height: 1rem;
      color: var(--muted-foreground);
      text-align: center;
      margin-top: 0.25rem;
    }
  </style>
  <script>
    (function() {
      const stored = localStorage.getItem('theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (stored === 'dark' || (!stored && systemDark)) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
<body>
  <div class="page">
    <div class="main">
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">Mock OAuth Service</h1>
          <p class="card-description">Select a test user to simulate enterprise SSO login.</p>
        </div>
        <form method="post" class="field-group">
          <input type="hidden" name="redirect_uri" value="{redirect_uri}">
          <input type="hidden" name="state" value="{state}">
          <div class="field">
            <label class="label" for="user">User</label>
            <select id="user" name="user" class="select" required>
{options}
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Authenticate</button>
        </form>
        <p class="footer">This is a mock authentication service for local development.</p>
      </div>
    </div>
  </div>
</body>
</html>"""


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
        f'              <option value="{key}">{user["name"]}</option>'
        for key, user in MOCK_USERS.items()
    )
    return HTMLResponse(
        content=LOGIN_HTML.replace("{redirect_uri}", redirect_uri)
        .replace("{state}", state)
        .replace("{options}", options_html),
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
