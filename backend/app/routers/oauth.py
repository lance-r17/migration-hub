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

import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import HTTP_CLIENT_VERIFY, settings
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


def _apply_template(template: str, match: re.Match) -> str:
    """Substitute $1, $2, … in *template* with the corresponding capture groups."""

    def replacer(m: re.Match) -> str:
        idx = int(m.group(1))
        val = match.group(idx)
        return val if val is not None else ""

    return re.sub(r"\$(\d+)", replacer, template)


def _derive_initials_from_names(given_name: str, family_name: str) -> str:
    """Derive initials from given + family name (e.g. Andy + ZHANG → AZ)."""
    initials = ""
    if given_name:
        initials += given_name[0].upper()
    if family_name:
        initials += family_name[0].upper()
    return initials


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
        async with httpx.AsyncClient(verify=HTTP_CLIENT_VERIFY) as client:
            resp = await client.get(
                userinfo_url,
                params={
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

    # 2. Unwrap and validate userinfo
    payload = userinfo
    contents = payload.get("data", {}).get("contents", []) if isinstance(payload, dict) else []
    if not contents:
        logger.warning("OAuth userinfo missing data.contents: %s", payload)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OAuth response missing user data",
        )

    raw_user = contents[0]
    logger.info("OAuth userinfo received: %s", raw_user)

    user_id: str | None = raw_user.get("staff_id")
    email: str | None = raw_user.get("email")
    name: str | None = raw_user.get("name")
    given_name: str = raw_user.get("given_name", "")
    family_name: str = raw_user.get("family_name", "")

    if not user_id or not email or not name:
        missing = []
        if not user_id:
            missing.append("staff_id")
        if not email:
            missing.append("email")
        if not name:
            missing.append("name")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OAuth response missing required fields: {', '.join(missing)}",
        )

    # 4. Extract global roles from AD group mappings
    member_of: list[str] = raw_user.get("member_of", [])
    matched_roles: list[str] = []
    if settings.oauth_role_mappings:
        try:
            role_mappings = json.loads(settings.oauth_role_mappings)
        except json.JSONDecodeError:
            logger.warning("Invalid OAUTH_ROLE_MAPPINGS JSON: %s", settings.oauth_role_mappings)
            role_mappings = []
        for mapping in role_mappings:
            mapping_regex = mapping.get("regex", "")
            mapping_role = mapping.get("role", "")
            if not mapping_regex or not mapping_role:
                continue
            compiled = re.compile(mapping_regex)
            for group in member_of:
                if compiled.search(group):
                    # mapping_role may contain multiple comma-separated roles
                    roles = [r.strip() for r in mapping_role.split(",") if r.strip()]
                    matched_roles.extend(roles)
                    break  # one match per mapping is enough

    # 5. Look up local user or auto-onboard
    user = await user_service.get_by_email(db, email)
    initials = _derive_initials_from_names(given_name, family_name)
    user_role = ",".join(dict.fromkeys(matched_roles)) if matched_roles else None
    if not user:
        logger.info("User not found in database, auto-onboarding: %s (%s)", email, user_id)
        new_user = User(
            id=user_id,
            name=name,
            email=email,
            department="Unassigned",
            initials=initials or _derive_initials(name),
            team=None,
            role=user_role,
        )
        user = await user_service.create_user(db, new_user)
    else:
        # Refresh name, initials, and role from OAuth data
        user.name = name
        user.initials = initials or _derive_initials(name)
        user.role = user_role
        await db.commit()
        await db.refresh(user)

    # 6. Sync AD group → project memberships
    matched_project_ids: set[str] = set()

    if settings.oauth_ad_group_mappings:
        try:
            ad_group_mappings = json.loads(settings.oauth_ad_group_mappings)
        except json.JSONDecodeError:
            logger.warning(
                "Invalid OAUTH_AD_GROUP_MAPPINGS JSON: %s",
                settings.oauth_ad_group_mappings,
            )
            ad_group_mappings = []
        for group in member_of:
            if (
                settings.oauth_ad_group_ou_filter
                and settings.oauth_ad_group_ou_filter not in group
            ):
                continue
            for mapping in ad_group_mappings:
                mapping_regex = mapping.get("regex", "")
                mapping_project_id = mapping.get("project_id", "")
                if not mapping_regex:
                    continue
                compiled = re.compile(mapping_regex)
                m = compiled.search(group)
                if m:
                    # Default to first capture group when project_id is omitted
                    project_id = (
                        _apply_template(mapping_project_id, m)
                        if mapping_project_id
                        else m.group(1)
                    )
                    if project_id:
                        matched_project_ids.add(project_id)
                    break  # first matching mapping wins for this group
    else:
        # Legacy single-regex mode
        project_regex = re.compile(settings.oauth_ad_group_regex)
        for group in member_of:
            if (
                settings.oauth_ad_group_ou_filter
                and settings.oauth_ad_group_ou_filter not in group
            ):
                continue
            m = project_regex.search(group)
            if m:
                matched_project_ids.add(m.group(1))

    project_ids_list = list(matched_project_ids)
    logger.info(
        "Syncing %d project associations for user %s from AD groups",
        len(project_ids_list),
        user.id,
    )
    await user_service.sync_user_projects(db, user.id, project_ids_list)

    # 7. Issue backend session token
    token = _create_session_token(user)

    return SSOExchangeResponse(
        user=UserOut.model_validate(user),
        token=token,
    )
