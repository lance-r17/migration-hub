# References for OAuth Auto-Onboarding

## Similar Implementations

### OAuth Exchange Flow

- **Location:** `backend/app/routers/oauth.py`
- **Relevance:** Main file to modify for SSO exchange logic. Contains the `sso_exchange` route that calls the OAuth `/userinfo` endpoint and currently returns 401 for unknown users.
- **Key patterns:** Uses `httpx.AsyncClient` for external calls, `user_service.get_by_email` for lookup, `_create_session_token` for JWT issuance.

### User Service

- **Location:** `backend/app/services/user_service.py`
- **Relevance:** Needs a new `create_user` function. Currently only has read operations.
- **Key patterns:** Async functions using SQLAlchemy `AsyncSession`, `select` queries.

### User Model

- **Location:** `backend/app/models/user.py`
- **Relevance:** Defines all fields required for new user creation, including non-nullable `department` and `initials`.

### Auth Dependency

- **Location:** `backend/app/auth.py`
- **Relevance:** Shows the existing user lookup pattern (`get_by_email`) and JWT verification. OIDC flow intentionally left unchanged.
