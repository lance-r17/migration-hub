# OAuth Auto-Onboarding Enhancement

## Overview

Enhance the backend OAuth SSO exchange flow to:
1. **Log userinfo** returned from the OAuth service `/userinfo` endpoint
2. **Auto-onboard first-time users** — if the user does not exist in the local database, create them instead of returning 401
3. **Restrict expected userinfo fields** — the OAuth response should only contain `id`, `email`, and `name`

## Context

### Current Flow (`backend/app/routers/oauth.py`)

The `sso_exchange` route currently:
1. Calls OAuth service `/api/v1/oauth/sso/userinfo` with `client_id`, `client_secret`, `code`
2. Extracts `email` from the response
3. Looks up user by email via `user_service.get_by_email(db, email)`
4. If user **not found** → returns `401 Unauthorized` with `"Authenticated user not found in database"`
5. If user **found** → issues backend JWT and returns `{user, token}`

### User Model (`backend/app/models/user.py`)

```python
class User(Base):
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    department: Mapped[str] = mapped_column(String, nullable=False)
    team: Mapped[str | None] = mapped_column(String, nullable=True)
    initials: Mapped[str] = mapped_column(String(10), nullable=False)
    role: Mapped[str | None] = mapped_column(String, nullable=True)
```

### User Service (`backend/app/services/user_service.py`)

Currently **read-only**. No `create_user` or `onboard_user` function exists.

## Decisions from Shaping

| Decision | Choice |
|---|---|
| Onboarding scope | **Only custom OAuth SSO exchange** (`oauth.py::sso_exchange`) — OIDC flow unchanged |
| Missing required fields | Derive `initials` from name (first letter of each word, uppercased). Use `"Unassigned"` as default `department`. `team` and `role` are `None`. |
| Default role | `None` (null) — no special privileges until admin assigns a role |
| User ID for new users | Use the `id` from OAuth userinfo response |
| Logging level | `logger.info` for successful userinfo retrieval; `logger.warning` for validation issues |
| Field restriction | Validate that OAuth response contains **only** `id`, `email`, `name`. Log warning if extra fields present. |

## Implementation Tasks

### Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-23-0644-oauth-auto-onboarding/` with:

- **plan.md** — This full plan
- **shape.md** — Shaping notes (scope, decisions, context)
- **standards.md** — Relevant standards (none found in agent-os/standards/)
- **references.md** — Pointers to reference implementations studied
- **visuals/** — Empty (no visuals provided)

### Task 2: Add Userinfo Logging and Validation

**File:** `backend/app/routers/oauth.py`

After receiving `userinfo` from the OAuth service:

1. **Log the full userinfo** at `INFO` level (sanitized — no secrets)
2. **Validate required fields**: ensure `id`, `email`, and `name` are present and non-empty
3. **Validate field restriction**: ensure no extra fields beyond `id`, `email`, `name` are present. If extras found, log a `warning` but do not fail — proceed with onboarding using only the expected fields
4. If any required field is missing, raise `401 Unauthorized` with a clear detail message

### Task 3: Add User Creation and Auto-Onboard Logic

**Files:**
- `backend/app/services/user_service.py` — add `create_user` function
- `backend/app/routers/oauth.py` — modify `sso_exchange` to auto-onboard

In `user_service.py`:
- Add `async def create_user(session: AsyncSession, user: User) -> User` that adds the user to the session, commits, and returns the user

In `oauth.py::sso_exchange`:
- After extracting email and userinfo fields:
  - Look up existing user by email
  - If found → proceed as before (issue token)
  - If **not found** → create new `User` with:
    - `id = userinfo["id"]`
    - `name = userinfo["name"]`
    - `email = userinfo["email"]`
    - `department = "Unassigned"`
    - `initials = _derive_initials(name)` (helper: first letter of each word, uppercased)
    - `team = None`
    - `role = None`
  - Call `user_service.create_user(db, new_user)`
  - Log `INFO` that a new user was onboarded
  - Issue token and return `{user, token}`

### Task 4: Verify and Test

1. Review the changes for consistency with existing code style
2. Ensure no imports are missing
3. Check that the `User` model is properly imported where needed
4. Run a quick syntax check on the modified files

## References

### OAuth Exchange Flow
- **Location:** `backend/app/routers/oauth.py`
- **Relevance:** Main file to modify for SSO exchange logic

### User Service
- **Location:** `backend/app/services/user_service.py`
- **Relevance:** Needs new `create_user` function

### User Model
- **Location:** `backend/app/models/user.py`
- **Relevance:** Defines fields required for new user creation

### Auth Dependency
- **Location:** `backend/app/auth.py`
- **Relevance:** OIDC flow intentionally left unchanged; shows existing user lookup pattern
