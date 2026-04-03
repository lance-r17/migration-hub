# References for Dev User Switcher

## Similar Implementations

### Role guard pattern
- **Location:** `frontend/src/pages/WavesPage.tsx` lines 49–65
- **Relevance:** Shows how `user?.role === 'Platform Migration Lead'` is used for access control — the primary thing the switcher exercises
- **Key patterns:** Early return with access-denied UI when role doesn't match

### Role-based nav filter
- **Location:** `frontend/src/components/layout/AppSidebar.tsx`
- **Relevance:** Filters sidebar nav items by `user.role` — the Waves item hides/shows when switching personas
- **Key patterns:** Derives visible nav from `user.role` on every render

### UserContext login pattern
- **Location:** `frontend/src/context/UserContext.tsx`
- **Relevance:** `login()` is the existing precedent for updating user state; `switchUser` follows the same pattern but without sessionStorage writes
- **Key patterns:** `setUser()` + `setIsAuthenticated()` + sessionStorage

### Mock data structure
- **Location:** `frontend/src/data/mock.ts` line 710 (`mockCurrentUser`)
- **Relevance:** `devPersonas` export follows the same `User` shape
- **Key patterns:** `id`, `name`, `email`, `department`, `role?`, `initials`
