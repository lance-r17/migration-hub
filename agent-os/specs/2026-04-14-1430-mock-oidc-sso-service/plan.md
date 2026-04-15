# Mock OIDC SSO Service — Plan

## Context

The frontend and backend currently use mock auth (no real tokens, no JWT validation). Enterprise SSO via Azure AD OIDC is planned but not yet ready. We need a realistic auth simulation that mirrors the production OIDC flow so the auth code is written once and switched to real Azure AD later by changing env vars alone.

**Approach:**
- **dex** (CNCF OIDC provider, `dexidp/dex:v2.41`) runs as a Docker Compose service with 4 static users matching the existing dev personas
- **Frontend** uses `react-oidc-context` for Authorization Code + PKCE flow
- **Backend** validates JWT access tokens via dex's JWKS endpoint, resolves the current user by `email` claim
- **Env-var toggle**: OIDC vars absent → existing mock behavior unchanged; vars present → full OIDC flow

**4 Mock Users** (matching seed data + dev-user-switcher personas):
| Email | User | Role |
|---|---|---|
| henry.wilson@corp.com | Henry Wilson (u-current) | Platform Migration Lead |
| alice.johnson@corp.com | Alice Johnson (u3) | Technical Lead |
| karen.lee@corp.com | Karen Lee (u12) | Business Owner |
| dan.brown@corp.com | Dan Brown (u2) | Viewer/no platform role |

All mock users share password: `Dev1234!`

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-14-1430-mock-oidc-sso-service/` with:
- `plan.md` — this plan
- `shape.md` — shaping notes (scope, decisions, context)
- `references.md` — pointers to existing auth code studied

---

## Task 2: dex Mock OIDC Service

### New file: `mock-oidc/config.yaml`

dex static config with:
- issuer: `http://localhost:5556/dex`
- storage: sqlite3 at `/var/dex/dex.db`
- `skipApprovalScreen: true`
- Public PKCE client `migration-hub` with redirect to `http://localhost:5173/callback`
- 4 static password users (bcrypt hashed, password: `Dev1234!`)

### Modify: `backend/docker-compose.yml`

Add dex service (port 5556), mount config, volume for dex.db.
Add `OIDC_ISSUER: http://dex:5556/dex` to backend service env.

---

## Task 3: Backend JWT Validation

- `backend/pyproject.toml` — add `python-jose[cryptography]>=3.3`
- `backend/app/config.py` — add `oidc_issuer: str = ""`, `oidc_audience: str = "migration-hub"`
- `backend/app/auth.py` (new) — `get_current_user` FastAPI dependency with OIDC toggle:
  - OIDC disabled (`oidc_issuer` empty) → falls back to `user_service.get_current(db)`
  - OIDC enabled → validates Bearer JWT via dex JWKS, extracts `email`, resolves user
- `backend/app/routers/users.py` — update `GET /users/me` to use `Depends(get_current_user)`
- `backend/.env.example` — add `OIDC_ISSUER=http://localhost:5556/dex`

---

## Task 4: Frontend OIDC Integration

- `frontend/package.json` — add `react-oidc-context@^3`, `oidc-client-ts@^3`
- `frontend/src/auth/oidcConfig.ts` (new) — OIDC `UserManagerSettings` + `isOidcEnabled` flag
- `frontend/src/auth/tokenStore.ts` (new) — module-level token store for auth header injection
- `frontend/src/pages/CallbackPage.tsx` (new) — OIDC redirect handler
- `frontend/src/App.tsx` — add `/callback` route
- `frontend/src/main.tsx` — conditional `AuthProvider` wrapper
- `frontend/src/context/UserContext.tsx` — sync with OIDC auth state when enabled
- `frontend/src/services/client.ts` — inject `Authorization: Bearer` header
- `frontend/src/components/login-form.tsx` — SSO button calls `signinRedirect()`
- `frontend/.env` / `.env.example` — add `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_REDIRECT_URI`

---

## Critical Files

| File | Change |
|---|---|
| `mock-oidc/config.yaml` | New — dex static config |
| `backend/docker-compose.yml` | Add dex service + dex_data volume |
| `backend/app/auth.py` | New — JWT validation dependency |
| `backend/app/config.py` | Add `oidc_issuer`, `oidc_audience` |
| `backend/app/routers/users.py` | Wire `get_current_user` into `/me` |
| `backend/pyproject.toml` | Add python-jose[cryptography] |
| `frontend/src/auth/oidcConfig.ts` | New — OIDC settings + enabled flag |
| `frontend/src/auth/tokenStore.ts` | New — module-level token store |
| `frontend/src/pages/CallbackPage.tsx` | New — OIDC redirect handler |
| `frontend/src/main.tsx` | Conditional AuthProvider wrap |
| `frontend/src/context/UserContext.tsx` | OIDC auth state integration |
| `frontend/src/services/client.ts` | Inject Authorization header |
| `frontend/src/components/login-form.tsx` | SSO button → signinRedirect |

---

## Verification

1. `cd backend && docker compose up` → dex at `http://localhost:5556/dex/.well-known/openid-configuration`
2. Set frontend `.env`: `VITE_OIDC_ISSUER=http://localhost:5556/dex`, `VITE_OIDC_CLIENT_ID=migration-hub`, `VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback`
3. `npm run dev` in `frontend/`
4. Click "Login with Enterprise SSO" → dex login page → `henry.wilson@corp.com` / `Dev1234!` → `/callback` → `/` → Henry Wilson loaded
5. DevTools Network: API calls include `Authorization: Bearer <jwt>`
6. Test all 4 personas
7. Remove OIDC env vars → confirm mock mode still works
8. `curl http://localhost:5556/dex/keys` returns JWKS
9. `curl -H "Authorization: Bearer badtoken" http://localhost:8000/api/v1/users/me` → 401
