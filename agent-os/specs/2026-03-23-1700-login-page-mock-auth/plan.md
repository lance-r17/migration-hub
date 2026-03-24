# Login Page with Mock SSO — Plan

See `/home/node/.claude/plans/modular-waddling-rabin.md` for the full implementation plan.

## Summary

Build a login page with mock SSO simulation for the Migration Hub SPA. Covers:
- `field.tsx` UI component (new)
- Extended `UserContext` with `isAuthenticated`, `login`, `logout`
- Mock `login()` service (returns `mockCurrentUser`)
- `LoginForm` and `LoginPage` components
- `ProtectedRoute` guarding existing routes
- NavUser logout wired up

## Files Changed

| File | Action |
|------|--------|
| `frontend/src/components/ui/field.tsx` | Create |
| `frontend/src/context/UserContext.tsx` | Modify |
| `frontend/src/services/client.ts` | Modify (add post method) |
| `frontend/src/services/users.ts` | Modify (add login fn) |
| `frontend/src/components/login-form.tsx` | Create |
| `frontend/src/pages/LoginPage.tsx` | Create |
| `frontend/src/App.tsx` | Modify |
| `frontend/src/components/layout/NavUser.tsx` | Modify |
