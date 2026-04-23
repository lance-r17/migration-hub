# OIDC Provider Configuration — Shaping Notes

## Scope

The migration-hub app already has a complete, production-ready OIDC implementation using the dex mock service for development. Switching to a real enterprise OIDC provider requires no code changes — only environment variables change. This spec produces operator-facing configuration documentation covering Azure AD / Entra ID (primary target) and generic OIDC-compliant providers (Okta, Google Workspace, Auth0, Keycloak, etc.).

## Decisions

- **Env-vars-only scope**: The existing implementation handles all OIDC providers identically via the same JWT validation code path. No code changes are needed; documentation covers configuration only.
- **Azure AD as primary example**: Most enterprise deployments will use Azure AD / Entra ID. It's documented with concrete Portal steps.
- **Generic OIDC as secondary**: Covers the common pattern for any standard-compliant IdP, with issuer URL patterns for Okta, Google, Auth0, and Keycloak.
- **Audience gotcha documented**: Azure AD sets `aud` = Application (client) ID, not the app name `"migration-hub"`. This is the most common misconfiguration and must be called out explicitly.
- **Email claim requirement documented**: The backend user lookup is keyed on the `email` claim. If the IdP doesn't include `email` in the token, login silently fails with 401. This must be explicit.
- **User provisioning noted**: The backend has no auto-provisioning — users must exist in the `users` table before login. This is an ops concern that must be in the guide.

## Context

- **Visuals:** None
- **References:** See `references.md` — existing auth code and mock OIDC spec studied
- **Product alignment:** Internal enterprise migration tool; auth will be real Azure AD for customer deployments

## Standards Applied

- None defined yet in `agent-os/standards/` — no standards directory exists in this repo
