# OIDC Provider Configuration Documentation — Plan

## Context

The migration-hub app already has a complete, production-ready OIDC authentication implementation. The architecture is designed so switching from the mock dex service to any real OIDC provider requires only environment variable changes — no code changes. This spec produces operator-facing documentation for Azure AD / Entra ID and generic OIDC-compliant providers.

## Deliverables

1. `shape.md` — Shaping notes and decisions
2. `references.md` — Pointers to the code files governing OIDC behavior
3. `standards.md` — External standards the implementation follows
4. `configuration-guide.md` — Operator configuration guide (primary deliverable)

## Key Points

- No code changes needed — env vars only
- `OIDC_AUDIENCE` must be set to the Application (client) ID for Azure AD (not the default `"migration-hub"`)
- Backend user lookup is keyed on the `email` JWT claim — users must exist in the `users` table
- Both `VITE_OIDC_ISSUER` (frontend) and `OIDC_ISSUER` (backend) must be identical
- dex service in `docker-compose.yml` should be removed in production

## Critical Files

| File | Role |
|---|---|
| `backend/app/auth.py` | JWT validation logic |
| `backend/app/config.py` | `oidc_issuer`, `oidc_audience` settings |
| `backend/.env.example` | Backend env var template |
| `frontend/src/auth/oidcConfig.ts` | Frontend OIDC settings + feature flag |
| `frontend/src/auth/oidcManager.ts` | UserManager singleton |
| `frontend/.env.example` | Frontend env var template |
| `mock-oidc/config.yaml` | dex config (dev only) |
| `backend/docker-compose.yml` | dex service (remove in production) |
