# Plan: Redirect to Login on Session Expiry

## Context

Currently, when a user's session expires and they refresh the frontend page, the app reads `isAuthenticated = true` from `sessionStorage` (key `'auth'`) and renders the protected route. API calls then fail with 401 Unauthorized, leaving the user on a blank page with no data displayed. The expected behavior is to detect the expired session and redirect to `/login`.

## Problem

- `UserContext` initializes `isAuthenticated` solely from `sessionStorage.getItem('auth')`, with no validation of the actual OIDC token or backend session.
- The API client throws on 401 but does not trigger any logout/redirect.
- `automaticSilentRenew: false` in OIDC config means tokens expire without refresh.

## Recommended Approach

### 1. Validate session on app load (UserContext)

In `UserContext.tsx`, when `isAuthenticated` is `true` from `sessionStorage`:

- Fast path: check `oidcManager?.getUser()` — if the user object exists and `user.expired` is true, call `logout()` and redirect to `/login` immediately.
- Backend validation: call `getCurrentUser()` (GET `/api/v1/users/me`). On success, populate `user` state. On any error (especially 401), call `logout()` and redirect to `/login`.

Use `window.location.assign('/login')` for the redirect since `UserProvider` is mounted outside `BrowserRouter` and cannot use `useNavigate`.

### 2. Add global 401 handler to API client

In `client.ts`, add a callback registration mechanism:

```ts
let onUnauthorized: (() => void) | null = null
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb
}
```

In `handleResponse`, when `res.status === 401`, call `onUnauthorized?.()` before throwing the error.

### 3. Wire up the 401 handler in UserContext

In `UserContext.tsx`, in a `useEffect`:

```ts
useEffect(() => {
  setOnUnauthorized(() => {
    logout()
    window.location.assign('/login')
  })
  return () => setOnUnauthorized(null)
}, [logout])
```

This decouples the API client from React context (avoids circular imports) while ensuring any 401 anywhere triggers logout + redirect.

### 4. Update E2E tests

Add tests in `auth.spec.ts`:
- Stale sessionStorage `auth` flag + 401 on `getCurrentUser` → redirects to `/login`
- In-app API 401 → redirects to `/login`

## Critical Files

| File | Action |
|------|--------|
| `frontend/src/context/UserContext.tsx` | Add session validation on mount; wire up 401 handler |
| `frontend/src/services/client.ts` | Add `setOnUnauthorized` and invoke on 401 |
| `frontend/e2e/tests/auth.spec.ts` | Add E2E tests for session expiry redirect |

## Verification

1. **Mock mode:** Start dev server, log in, manually set `sessionStorage.auth = 'true'` and verify page loads normally.
2. **Simulate expiry:** With a real backend + OIDC, wait for token expiry (or tamper with token), refresh page, verify redirect to `/login`.
3. **In-app 401:** Simulate a 401 response from an API endpoint while browsing, verify redirect to `/login`.
4. **Run E2E:** `npx playwright test e2e/tests/auth.spec.ts`

## Spec Documentation

Saved to `agent-os/specs/2026-04-21-0105-session-expiry-redirect/`:
- `shape.md` — scope, decisions, context
- `references.md` — pointers to existing auth code
- `standards.md` — N/A (no standards directory)
