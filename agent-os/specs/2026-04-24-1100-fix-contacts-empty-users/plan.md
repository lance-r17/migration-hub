# Plan: Fix Empty Contacts/Ownership Section

## Context

In backend mode, `getUsers()` and `getProjectUsers()` both called `.map(fromApi)` — a function that doesn't exist. The correct name is `userFromApi` (defined on line 11 of the same file). This caused a `ReferenceError` that left users arrays empty, making the Contact & Ownership section blank and the ContactsOwnershipDrawer dropdowns unpopulated.

## Fix

`frontend/src/services/users.ts` — changed `.map(fromApi)` → `.map(userFromApi)` on lines 22 and 34.
