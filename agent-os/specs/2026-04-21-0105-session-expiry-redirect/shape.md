# Session Expiry Redirect — Shaping Notes

## Scope

When a user's session expires (OIDC token expired or backend session invalid), refreshing the frontend page currently leaves the user on a blank page because:
- `sessionStorage` still has `auth = 'true'`
- `UserContext` trusts this flag without validating the actual session
- API calls then 401, and no data loads

The fix ensures the app detects expired sessions and redirects to `/login`.

## Decisions

- **Validation strategy:** Both local token expiry check (via `oidc-client-ts` `user.expired`) AND backend validation (via `GET /api/v1/users/me`).
- **Redirect mechanism:** `window.location.assign('/login')` because `UserProvider` is mounted outside `BrowserRouter` and cannot use `useNavigate`.
- **Global 401 handler:** Decoupled callback pattern (`setOnUnauthorized`) in `client.ts` to avoid circular imports with React context.
- **Scope includes:** Page refresh AND in-app API 401s.

## Context

- **Visuals:** None (behavioral change)
- **References:** `UserContext.tsx`, `client.ts`, `App.tsx`, `oidcManager.ts`
- **Product alignment:** N/A — security/UX fix

## Standards Applied

- N/A (no standards directory exists)
