# Dev User Switcher — Plan

## Context

Testing role-based access in the Migration Hub requires logging out and back in to switch users. This feature adds a dev-only "Switch User" submenu to the NavUser dropdown, letting developers instantly impersonate different role personas to observe permission differences live.

## Tasks

### Task 1: Add devPersonas to mock.ts
Insert `devPersonas` export in `frontend/src/data/mock.ts` after `mockCurrentUser`. Four personas covering all role tiers: Platform Migration Lead, Technical Lead, Business Owner, and viewer (no role).

### Task 2: Extend UserContext
Add `switchUser(user: User)` callback and `isImpersonating` derived boolean to `UserContext`. Track `defaultUserId` to detect deviation from the real logged-in user. `switchUser` does not touch sessionStorage — page refresh reverts to real user.

### Task 3: Update NavUser
- Wrap avatar in `relative` div with amber dot overlay when `isImpersonating`
- Add DEV-only `DropdownMenuSub` with flyout listing all devPersonas
- Use `DropdownMenuPortal` to escape sidebar overflow clipping
- Highlight active persona with `bg-accent`

## Files Modified

- `frontend/src/data/mock.ts` — `devPersonas` export
- `frontend/src/context/UserContext.tsx` — `switchUser`, `isImpersonating`, `defaultUserId`
- `frontend/src/components/layout/NavUser.tsx` — switcher UI + amber dot
