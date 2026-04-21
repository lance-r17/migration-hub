# References for Session Expiry Redirect

## Similar Implementations

### Auth Guard / Protected Route

- **Location:** `frontend/src/App.tsx`
- **Relevance:** Existing `ProtectedRoute` component already redirects to `/login` when `!isAuthenticated`, but `isAuthenticated` is initialized from `sessionStorage` without validation.
- **Key patterns:** `Navigate to="/login" replace` — not usable here because `UserProvider` is outside the router.

### UserContext Session Initialization

- **Location:** `frontend/src/context/UserContext.tsx`
- **Relevance:** The mount `useEffect` calls `getCurrentUser()` but does not handle errors or 401s.
- **Key patterns:** `AUTH_KEY = 'auth'` in `sessionStorage`; `getCurrentUser()` service call.

### API Client

- **Location:** `frontend/src/services/client.ts`
- **Relevance:** Thin `fetch` wrapper with no interceptor or 401-specific handling.
- **Key patterns:** `handleResponse` throws on `!res.ok`; `authHeader()` adds Bearer token from `oidcManager.getUser()`.

### OIDC Token Management

- **Location:** `frontend/src/auth/oidcManager.ts`, `frontend/src/auth/oidcConfig.ts`
- **Relevance:** `oidc-client-ts` `UserManager` with `automaticSilentRenew: false`.
- **Key patterns:** `oidcManager.getUser()` returns `User` object with `expired` property.
