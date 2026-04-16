"""
Authentication dependency for FastAPI routes.

When OIDC_ISSUER is configured, validates the Bearer JWT and resolves the
user by email claim. When not configured, falls back to the mock CURRENT_USER_ID
behaviour so existing dev workflows continue to work without any auth setup.
"""
from __future__ import annotations

import logging
import time

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jws as jose_jws
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services import user_service

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# Module-level JWKS cache — keyed by issuer URL.
# Refreshed on each process start. For dev use only.
_jwks_cache: dict[str, dict] = {}


async def _fetch_jwks(issuer: str) -> dict:
    """Fetch JSON Web Key Set from the OIDC provider's /keys endpoint."""
    if issuer in _jwks_cache:
        return _jwks_cache[issuer]
    jwks_uri = f"{issuer}/keys"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_uri, timeout=10.0)
            resp.raise_for_status()
            jwks = resp.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to reach OIDC provider: {exc}",
        )
    _jwks_cache[issuer] = jwks
    return jwks


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolve the current authenticated user.

    - OIDC disabled (OIDC_ISSUER not set): returns CURRENT_USER_ID mock user.
    - OIDC enabled: validates Bearer JWT, extracts email claim, looks up user.
    """
    if not settings.oidc_issuer:
        user = await user_service.get_current(db)
        if not user:
            raise HTTPException(status_code=404, detail="Current user not found")
        return user

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        jwks = await _fetch_jwks(settings.oidc_issuer)
        # Verify signature only — skips at_hash validation, which is a frontend
        # concern (oidc-client-ts handles it) not a resource-server concern.
        jose_jws.verify(token, jwks, algorithms=["RS256"])
        payload = jwt.get_unverified_claims(token)
    except Exception as exc:
        logger.warning("Token signature verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate standard claims manually
    now = time.time()
    aud = payload.get("aud", [])
    if isinstance(aud, str):
        aud = [aud]
    if (
        payload.get("iss") != settings.oidc_issuer
        or settings.oidc_audience not in aud
        or payload.get("exp", 0) < now
    ):
        logger.warning("Token claims invalid: iss=%s aud=%s exp=%s", payload.get("iss"), payload.get("aud"), payload.get("exp"))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email: str | None = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing email claim",
        )

    user = await user_service.get_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found in database",
        )
    return user


_ADMIN_ROLES = {"admin", "Platform Migration Lead"}


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that allows admin and Platform Migration Lead users."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user
