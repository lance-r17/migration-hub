# References for OAuth Userinfo AD Sync

## Similar Implementations

### OAuth Router

- **Location:** `backend/app/routers/oauth.py`
- **Relevance:** Main file modified for SSO exchange logic. Already contains code exchange, auto-onboarding, and JWT issuance.
- **Key patterns:** `httpx.AsyncClient` for external calls, `user_service.get_by_email` for lookup, `User` model for auto-onboarding.

### User Service

- **Location:** `backend/app/services/user_service.py`
- **Relevance:** Extended with `sync_user_projects()` helper.
- **Key patterns:** Async session operations, simple CRUD wrappers, `selectinload` for eager loading.

### ProjectUser Model

- **Location:** `backend/app/models/project_user.py`
- **Relevance:** Existing association table between users and projects. Composite PK (`project_id`, `user_id`) with nullable `role`.
- **Key patterns:** SQLAlchemy ORM relationship back-populates on both `Project` and `User`.

### Mock OAuth Service

- **Location:** `mock-oauth/main.py`
- **Relevance:** Updated to return the wrapped `data.contents` format and new user fields (`staff_id`, `given_name`, `family_name`, `member_of`).
- **Key patterns:** In-memory code store, simple FastAPI endpoints.
