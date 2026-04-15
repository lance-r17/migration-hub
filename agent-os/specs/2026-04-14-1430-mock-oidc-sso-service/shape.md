# Mock OIDC SSO Service — Shaping Notes

## Scope

Build a separate mock OIDC service that simulates enterprise SSO (Azure AD) login for development. The service enables realistic auth simulation between the frontend (React SPA) and backend (FastAPI) before the real Azure AD OIDC is ready. Switching from mock to real OIDC requires only changing env vars.

## Decisions

- **dex over node-oidc-provider / Keycloak**: Zero custom code — pure YAML config, Docker-native, CNCF-backed, spec-compliant. Keycloak is too heavy; node-oidc-provider requires writing a custom Node.js service.
- **Full flow (not frontend-only)**: Both frontend OIDC client and backend JWT validation are implemented. The simulated auth is production-identical — same code path for mock and real Azure AD.
- **4 dev personas reused**: henry.wilson@corp.com (Platform Migration Lead), alice.johnson@corp.com (TL), karen.lee@corp.com (BO), dan.brown@corp.com (viewer). Same users as existing dev-user-switcher and seed data.
- **Env-var toggle**: When `VITE_OIDC_ISSUER` is absent → existing mock behavior unchanged. When set → full OIDC flow. No code branches needed beyond the initial check.
- **PKCE (public client)**: No client secret. Correct for browser-based SPAs per OAuth 2.1 best practices.
- **Authorization Code + PKCE flow**: The secure flow for SPAs (no implicit flow).
- **Token store pattern**: Module-level `tokenStore.ts` lets `client.ts` inject the Bearer header without threading tokens through every service function.
- **Backend JWKS caching**: JWKS fetched once on first authenticated request and cached in-process. No startup dependency on dex being available.
- **Password for mock users**: `Dev1234!` — memorable, meets common complexity requirements, clearly a dev password.

## Context

- **Visuals:** None
- **References:** See `references.md` — existing auth code studied
- **Product alignment:** Internal tool only; auth is dev-phase simulation, not final product auth

## Standards Applied

- None defined yet in `agent-os/standards/` — no standards directory exists in this repo
