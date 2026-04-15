# References for Mock OIDC SSO Service

## Existing Auth Implementations

### Frontend Auth State — UserContext

- **Location:** `frontend/src/context/UserContext.tsx`
- **Relevance:** Core auth state manager. Stores `isAuthenticated` in `sessionStorage`, exposes `login()` / `logout()` / `switchUser()`. Extended to drive auth state from OIDC when enabled.
- **Key patterns:** sessionStorage flag for persistence; `getCurrentUser()` call on mount to hydrate user profile; `defaultUserId` for impersonation detection

### Frontend API Client

- **Location:** `frontend/src/services/client.ts`
- **Relevance:** All API calls go through `apiClient.get/post/put`. Updated to inject `Authorization: Bearer` header from `tokenStore`.
- **Key patterns:** `USE_MOCK = !BASE_URL` toggle; plain `fetch` with `Content-Type: application/json`

### Frontend Login Form

- **Location:** `frontend/src/components/login-form.tsx`
- **Relevance:** Contains "Login with Enterprise SSO" button — wired to `signinRedirect()` when OIDC enabled.
- **Key patterns:** Calls `loginService('', '')` (mock); redirects to `/` on success

### Frontend Login Service

- **Location:** `frontend/src/services/users.ts`
- **Relevance:** `login()`, `getCurrentUser()` — mock/API toggle pattern. `getCurrentUser()` called after OIDC auth to hydrate user profile.

### Dev Personas

- **Location:** `frontend/src/data/mock.ts` — `devPersonas` export (line ~734)
- **Relevance:** Defines the 4 test users (u-current, u3, u12, u2). Same users configured as dex static passwords.

### Backend Mock Auth

- **Location:** `backend/app/routers/users.py`
- **Relevance:** `POST /auth/login` and `GET /users/me`. The `/me` endpoint is updated to use `get_current_user` JWT dependency.
- **Key patterns:** No credential validation today; `CURRENT_USER_ID` env var resolves current user

### Backend User Service

- **Location:** `backend/app/services/user_service.py`
- **Relevance:** `get_current(db)` (by CURRENT_USER_ID) and `get_by_email(db, email)` — both used in `auth.py` for mock fallback and JWT user resolution respectively.

### Backend Config

- **Location:** `backend/app/config.py`
- **Relevance:** Pydantic Settings class. Extended with `oidc_issuer` and `oidc_audience`.

### Docker Compose

- **Location:** `backend/docker-compose.yml`
- **Relevance:** Existing `db` and `backend` services. `dex` service added alongside them.

### Login Page Mock Auth Spec

- **Location:** `agent-os/specs/2026-03-23-1700-login-page-mock-auth/`
- **Relevance:** Original login UI spec. Documents sessionStorage strategy and mock SSO decisions.

### Dev User Switcher Spec

- **Location:** `agent-os/specs/2026-03-26-1000-dev-user-switcher/`
- **Relevance:** Documents the 4 dev personas (all role tiers) and ephemeral impersonation pattern.

### Backend Modeling Spec

- **Location:** `agent-os/specs/2026-04-14-1400-backend-modeling-api-service/`
- **Relevance:** Documents the "no auth at v1, service layer ready for JWT" design decision. The `actor_user_id` service parameter is designed to be non-breaking for JWT wiring.
