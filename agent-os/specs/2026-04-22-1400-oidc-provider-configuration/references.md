# References for OIDC Provider Configuration

## Auth Implementation

### Backend JWT Validation
- **Location:** `backend/app/auth.py`
- **Relevance:** Core auth logic — fetches JWKS from `{oidc_issuer}/keys`, validates RS256 signature, checks `iss`/`aud`/`exp` claims, looks up user by `email` claim
- **Key patterns:** `oidc_issuer` empty → mock fallback; JWKS cached in-process with rotation refresh

### Backend Settings
- **Location:** `backend/app/config.py`
- **Relevance:** Defines `oidc_issuer: str = ""` and `oidc_audience: str = "migration-hub"` — the two backend env vars

### Backend Env Template
- **Location:** `backend/.env.example`
- **Relevance:** Shows `OIDC_ISSUER=http://localhost:5556/dex` as the env var name

### Frontend OIDC Config + Feature Flag
- **Location:** `frontend/src/auth/oidcConfig.ts`
- **Relevance:** Reads `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_REDIRECT_URI`; sets `isOidcEnabled` flag used everywhere

### Frontend UserManager Singleton
- **Location:** `frontend/src/auth/oidcManager.ts`
- **Relevance:** `oidcManager` is null in mock mode, UserManager instance in OIDC mode; imported directly wherever needed

### API Client — Auth Header Injection
- **Location:** `frontend/src/services/client.ts`
- **Relevance:** `authHeader()` calls `oidcManager.getUser()` and injects `Authorization: Bearer` on every request

### Frontend Env Template
- **Location:** `frontend/.env.example`
- **Relevance:** Shows `VITE_OIDC_*` vars commented out (mock mode default)

## Mock OIDC Service

### dex Config
- **Location:** `mock-oidc/config.yaml`
- **Relevance:** Shows current issuer (`http://localhost:5556/dex`), client ID (`migration-hub`), redirect URI, and 4 mock users

### docker-compose
- **Location:** `backend/docker-compose.yml`
- **Relevance:** dex service definition — to be removed or commented out in production

## Prior Spec

### Mock OIDC SSO Service Spec
- **Location:** `agent-os/specs/2026-04-14-1430-mock-oidc-sso-service/`
- **Relevance:** Documents all design decisions for the existing auth implementation; explains why dex was chosen, PKCE flow, env-var toggle, JWKS caching
