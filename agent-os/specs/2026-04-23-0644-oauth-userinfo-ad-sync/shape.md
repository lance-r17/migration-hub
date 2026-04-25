# OAuth Userinfo AD Sync — Shaping Notes

## Scope

Update the backend SSO exchange flow to handle a new wrapped userinfo format from the enterprise OAuth service, and auto-assign users to projects based on their Active Directory group memberships.

## Decisions

- **Wrapped format**: The OAuth service returns `data.contents[0]` instead of a flat user object. The backend must unwrap before processing.
- **Field mapping**: `staff_id` → `id`, `name` → `name`, `email` → `email`, `given_name` + `family_name` → `initials`.
- **AD group filtering**: Configurable regex (`OAUTH_AD_GROUP_REGEX`) extracts `{project_id}` from `member_of` DNs. A separate `OU=Ali` substring filter is also configurable.
- **Project sync strategy**: Full replace on every login. Delete all existing `ProjectUser` rows for the user, then re-create from current AD groups. This keeps AD as the single source of truth.
- **Role assignment**: Static `"member"` role for all AD-derived associations.
- **Existing user handling**: Look up by email. If found, update `name` and `initials` but preserve the existing DB primary key to avoid FK cascade issues.

## Context

- **Visuals:** None
- **References:** `backend/app/routers/oauth.py`, `backend/app/services/user_service.py`, `backend/app/models/project_user.py`
- **Product alignment:** Supports RBAC and project-based access control per the product mission.

## Standards Applied

- None from `agent-os/standards/` (directory does not exist).
- Follows existing backend patterns: async SQLAlchemy, FastAPI dependency injection, service layer abstraction.
