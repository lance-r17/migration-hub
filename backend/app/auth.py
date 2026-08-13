"""
Authentication dependency for FastAPI routes.

Supports four modes (checked in priority order):

0. API Key mode (X-API-Key header present):
   - SHA-256 hashes the key, looks up matching service account in DB.

1. Custom OAuth mode (OAUTH_SERVICE_URL set):
   - Validates the Bearer token as a backend-signed JWT (HS256).
   - Extracts email claim, looks up user in DB.

2. Standard OIDC mode (OIDC_ISSUER set, no OAUTH_SERVICE_URL):
   - Validates the Bearer token as an OIDC JWT (RS256 via JWKS).
   - Extracts email claim, looks up user in DB.

3. Mock mode (neither configured):
   - Returns the CURRENT_USER_ID mock user for zero-config dev.
"""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime, timezone

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import jws as jose_jws
from jose import jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import HTTP_CLIENT_VERIFY, settings
from app.database import get_db
from app.models.user import User
from app.services import user_service

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Module-level JWKS cache — keyed by issuer URL.
# Refreshed on each process start. For dev use only.
_jwks_cache: dict[str, dict] = {}


# ─── JWKS fetch (OIDC mode) ──────────────────────────────────────────────────

async def _fetch_jwks(issuer: str, *, force_refresh: bool = False) -> dict:
    """Fetch JSON Web Key Set from the OIDC provider's /keys endpoint."""
    if not force_refresh and issuer in _jwks_cache:
        return _jwks_cache[issuer]
    jwks_uri = f"{issuer}/keys"
    try:
        async with httpx.AsyncClient(verify=HTTP_CLIENT_VERIFY) as client:
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


# ─── Backend JWT verification (Custom OAuth mode) ────────────────────────────


def _verify_backend_jwt(token: str) -> dict:
    """Verify a backend-signed HS256 JWT. Returns the payload dict."""
    try:
        payload = jose_jwt.decode(
            token,
            settings.session_secret_key,
            algorithms=["HS256"],
            issuer="migration-hub-backend",
            audience="migration-hub",
        )
    except jose_jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jose_jwt.JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Extra safety: validate exp claim explicitly
    exp = payload.get("exp")
    if exp is not None and datetime.now(timezone.utc).timestamp() > exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


# ─── OIDC JWT verification (Standard OIDC mode) ──────────────────────────────


async def _verify_oidc_jwt(token: str) -> dict:
    """Verify an OIDC RS256 JWT via JWKS. Returns the payload dict."""
    jwks = await _fetch_jwks(settings.oidc_issuer)
    try:
        jose_jws.verify(token, jwks, algorithms=["RS256"])
    except Exception:
        # Keys may have rotated (e.g., provider restart); retry with fresh JWKS once.
        try:
            jwks = await _fetch_jwks(settings.oidc_issuer, force_refresh=True)
            jose_jws.verify(token, jwks, algorithms=["RS256"])
        except Exception as exc:
            logger.warning("Token signature verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    try:
        payload = jose_jwt.get_unverified_claims(token)
    except Exception as exc:
        logger.warning("Unable to parse token claims: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

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
        logger.warning(
            "Token claims invalid: iss=%s aud=%s exp=%s",
            payload.get("iss"),
            payload.get("aud"),
            payload.get("exp"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


# ─── API Key verification (service accounts) ────────────────────────────────


async def _verify_api_key(api_key: str, db: AsyncSession) -> User:
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    user = await user_service.get_by_api_key_hash(db, key_hash)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return user


# ─── Main dependency ─────────────────────────────────────────────────────────


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    api_key: str | None = Depends(_api_key_header),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolve the current authenticated user.

    Priority:
      0. API Key (X-API-Key header)             → verify against service account hash
      1. Custom OAuth (OAUTH_SERVICE_URL set)   → verify backend JWT
      2. Standard OIDC (OIDC_ISSUER set)        → verify OIDC JWT via JWKS
      3. Mock mode (neither set)                → return CURRENT_USER_ID user
    """
    # ── 0. API Key mode ─────────────────────────────────────────────────────
    if api_key:
        return await _verify_api_key(api_key, db)

    # ── 1. Custom OAuth mode ────────────────────────────────────────────────
    if settings.oauth_service_url:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = _verify_backend_jwt(credentials.credentials)
        email: str | None = payload.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session missing email claim",
            )

        user = await user_service.get_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found in database",
            )
        return user

    # ── 2. Standard OIDC mode ───────────────────────────────────────────────
    if settings.oidc_issuer:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = await _verify_oidc_jwt(credentials.credentials)
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

    # ── 3. Mock mode ────────────────────────────────────────────────────────
    user = await user_service.get_current(db)
    if not user:
        raise HTTPException(status_code=404, detail="Current user not found")
    return user


# ─── Admin dependency ────────────────────────────────────────────────────────

_ADMIN_ROLES = {"admin"}


def _user_has_admin_role(role: str | None) -> bool:
    """Check whether a role string (which may be comma-separated) contains an admin role."""
    if not role:
        return False
    user_roles = {r.strip() for r in role.split(",") if r.strip()}
    return not user_roles.isdisjoint(_ADMIN_ROLES)


def _user_has_bgi_cloud_lead_role(role: str | None) -> bool:
    if not role:
        return False
    user_roles = {r.strip() for r in role.split(",") if r.strip()}
    return "bgi_cloud_lead" in user_roles


def _user_has_engagement_reviewer_role(role: str | None) -> bool:
    if not role:
        return False
    user_roles = {r.strip() for r in role.split(",") if r.strip()}
    return "engagement_reviewer" in user_roles


def _user_has_platform_lead_role(role: str | None) -> bool:
    if not role:
        return False
    user_roles = {r.strip() for r in role.split(",") if r.strip()}
    return "platform_migration_lead" in user_roles


async def require_bgi_cloud_lead(
    current_user: User = Depends(get_current_user),
) -> User:
    if not _user_has_bgi_cloud_lead_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="BGI Cloud Lead role required",
        )
    return current_user


async def require_engagement_reviewer(
    current_user: User = Depends(get_current_user),
) -> User:
    if not _user_has_engagement_reviewer_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Engagement Reviewer role required",
        )
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that allows admin users."""
    if not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


async def require_platform_lead_or_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency that allows Platform Migration Leads or admin users."""
    if not _user_has_platform_lead_role(current_user.role) and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Migration Lead or Admin role required",
        )
    return current_user
