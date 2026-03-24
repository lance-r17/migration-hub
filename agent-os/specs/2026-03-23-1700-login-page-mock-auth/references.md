# References for Login Page with Mock SSO

## Similar Implementations

### UserContext

- **Location:** `frontend/src/context/UserContext.tsx`
- **Relevance:** Extended with `isAuthenticated`, `login`, `logout` — same pattern as existing context

### Mock Data / Store

- **Location:** `frontend/src/data/mock.ts`, `frontend/src/data/store.ts`
- **Relevance:** `store.getCurrentUser()` returns the mock current user (Henry Wilson) for login simulation

### Service Layer Pattern

- **Location:** `frontend/src/services/users.ts`
- **Relevance:** USE_MOCK toggle pattern — login follows the same guard: mock path vs real API path

### NavUser

- **Location:** `frontend/src/components/layout/NavUser.tsx`
- **Relevance:** "Log out" item wired to `logout()` + `navigate('/login')`
