# OAuth Auto-Onboarding — Shaping Notes

## Scope

Enhance the backend OAuth SSO exchange flow to:
1. Log userinfo returned from OAuth service `/userinfo`
2. Auto-onboard first-time users (create in DB if not found)
3. Restrict expected userinfo fields to `id`, `email`, `name`

## Decisions

- **Onboarding scope:** Only custom OAuth SSO exchange (`oauth.py::sso_exchange`). OIDC flow in `auth.py` intentionally left unchanged.
- **Missing required fields:** Derive `initials` from name (first letter of each word, uppercased). Use `"Unassigned"` as default `department`. `team` and `role` are `None`.
- **Default role:** `None` — users have no special privileges until an admin assigns a role.
- **User ID for new users:** Use the `id` from OAuth userinfo response.
- **Logging:** `logger.info` for successful userinfo; `logger.warning` for validation issues.
- **Field restriction:** Validate OAuth response contains only `id`, `email`, `name`. Log warning if extra fields present, but do not fail.

## Context

- **Visuals:** None
- **References:**
  - `backend/app/routers/oauth.py` — OAuth exchange flow
  - `backend/app/services/user_service.py` — read-only user service
  - `backend/app/models/user.py` — User model with required fields
  - `backend/app/auth.py` — OIDC auth dependency (left unchanged)
- **Product alignment:** N/A — this is an infrastructure/auth enhancement

## Standards Applied

- None found in `agent-os/standards/`
