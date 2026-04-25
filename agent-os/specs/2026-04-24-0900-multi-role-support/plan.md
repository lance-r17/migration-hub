# Multi-Role Support Across the Application

## Context

The backend stores multiple roles as a comma-separated string in `users.role` and already handles them correctly in `auth.py` and the OAuth flow. The frontend typed `User.role` as `string?` and used `===` everywhere, so a user with two roles would never match any guard. This change closes that gap.

## Changes

### 1. `frontend/src/types/index.ts`
`role?: string` → `role: string[]`

### 2. `frontend/src/services/users.ts`
Added `fromApi()` that splits the API's comma-separated role string into `string[]`. Applied to `getUsers`, `getCurrentUser`, `getProjectUsers`, and `login`.

### 3. `frontend/src/data/mock.ts`
Updated `mockCurrentUser` and `devPersonas` to use `string[]` roles. Added `role: []` to all entries in `mockUsers`.

### 4. Role-check sites updated

| File | Change |
|------|--------|
| `components/layout/AppSidebar.tsx` | `user?.role.includes(item.requiresRole)` |
| `components/layout/NavUser.tsx` | `persona.role.join(', ')` display |
| `components/drawers/ContactsOwnershipDrawer.tsx` | `u.role.includes('Platform Migration Lead')` |
| `hooks/use-projects.ts` | `user?.role.includes('Platform Migration Lead') ?? false` |
| `pages/AdminJiraJobsPage.tsx` | `user?.role.some(r => ADMIN_ROLES.has(r)) ?? false` |
| `pages/SettingsPage.tsx` | `!user?.role.includes('Platform Migration Lead')` |
| `pages/ProjectDetailsPage.tsx` | `user?.role.includes('Platform Migration Lead') ?? false` |
| `pages/HomePage.tsx` | `user?.role.includes('Platform Migration Lead') ?? false` |
| `pages/WavesPage.tsx` | `user?.role.includes('Platform Migration Lead') ?? false` |
| `pages/FinancePage.tsx` | `user?.role.includes('Platform Migration Lead') ?? false` |

## No backend changes

`auth.py._user_has_admin_role()` already splits on commas. OAuth flow already joins with commas.

## Verification

`npx tsc --noEmit` — zero errors (confirmed).
