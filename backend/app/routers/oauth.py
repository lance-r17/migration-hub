"""
OAuth router for the custom enterprise SSO flow.

Flow:
  1. Frontend redirects user to the OAuth service /authentication endpoint
  2. OAuth service authenticates user and redirects to frontend /callback with a code
  3. Frontend POSTs the code to /api/v1/auth/sso/exchange
  4. Backend calls the OAuth service /userinfo endpoint with client credentials
  5. Backend looks up the user by email, issues a backend-signed JWT
  6. Backend returns {user, token} to the frontend
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.oauth import SSOExchangeRequest, SSOExchangeResponse, SSOLoginUrlResponse
from app.schemas.user import UserOut
from app.services import user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _derive_initials(name: str) -> str:
    """Derive initials from a full name (first letter of each word, uppercased)."""
    return "".join(part[0].upper() for part in name.split() if part)


def _create_session_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.session_max_age_minutes),
        "iss": "migration-hub-backend",
        "aud": "migration-hub",
    }
    return jose_jwt.encode(payload, settings.session_secret_key, algorithm="HS256")


# ─── Routes ──────────────────────────────────────────────────────────────────


@router.get("/sso/login-url", response_model=SSOLoginUrlResponse)
async def sso_login_url(
    redirect_uri: str = "http://localhost:5173/callback",
) -> SSOLoginUrlResponse:
    """Return the fully-formed OAuth service authentication URL."""
    if not settings.oauth_service_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth service not configured",
        )

    url = (
        f"{settings.oauth_service_url}/api/v1/oauth/sso/authentication"
        f"?client_id={settings.oauth_client_id}"
        f"&redirect_uri={redirect_uri}"
    )
    return SSOLoginUrlResponse(url=url)


@router.post("/sso/exchange", response_model=SSOExchangeResponse)
async def sso_exchange(
    body: SSOExchangeRequest,
    db: AsyncSession = Depends(get_db),
) -> SSOExchangeResponse:
    """
    Exchange a one-time authorization code for a user session.

    1. Calls the OAuth service /userinfo endpoint with client credentials
    2. Looks up the user by email in the local database
    3. Issues a backend-signed JWT session token
    """
    if not settings.oauth_service_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth service not configured",
        )

    # 1. Exchange code for userinfo with the OAuth service
    userinfo_url = f"{settings.oauth_service_url}/api/v1/oauth/sso/userinfo"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                userinfo_url,
                json={
                    "client_id": settings.oauth_client_id,
                    "client_secret": settings.oauth_client_secret,
                    "code": body.code,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            userinfo = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("OAuth service returned error: %s", exc.response.text)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization code",
        )
    except Exception as exc:
        logger.warning("Unable to reach OAuth service: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to reach OAuth service",
        )

    # 2. Log and validate userinfo
    logger.info("OAuth userinfo received: %s", userinfo)

    # Validate required fields
    user_id: str | None = userinfo.get("id")
    email: str | None = userinfo.get("email")
    name: str | None = userinfo.get("name")

    if not user_id or not email or not name:
        missing = [f for f in ("id", "email", "name") if not userinfo.get(f)]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OAuth response missing required fields: {', '.join(missing)}",
        )

    # Validate field restriction (expected only id, email, name)
    allowed_fields = {"id", "email", "name"}
    extra_fields = set(userinfo.keys()) - allowed_fields
    if extra_fields:
        logger.warning(
            "OAuth userinfo contains unexpected fields (expected only id, email, name): %s",
            extra_fields,
        )

    # 3. Look up local user or auto-onboard
    user = await user_service.get_by_email(db, email)
    if not user:
        logger.info("User not found in database, auto-onboarding: %s (%s)", email, user_id)
        new_user = User(
            id=user_id,
            name=name,
            email=email,
            department="Unassigned",
            initials=_derive_initials(name),
            team=None,
            role=None,
        )
        user = await user_service.create_user(db, new_user)

    # 4. Issue backend session token
    token = _create_session_token(user)

    return SSOExchangeResponse(
        user=UserOut.model_validate(user),
        token=token,
    )
