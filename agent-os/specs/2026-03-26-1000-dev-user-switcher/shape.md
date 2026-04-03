# Dev User Switcher — Shaping Notes

## Scope

Add a dev-only "Switch User" flyout submenu to the `NavUser` sidebar dropdown. Selecting a persona instantly updates the `UserContext` user, causing the app to re-render with that user's role — showing/hiding nav items, restricting pages, etc. An amber dot on the avatar indicates when a non-default persona is active. Ephemeral: page refresh reverts to the real logged-in user.

## Decisions

- **Dev-only guard**: `import.meta.env.DEV` wraps the submenu; not rendered in production builds
- **Ephemeral impersonation**: `switchUser` calls `setUser()` without touching `sessionStorage`, so a refresh always restores the real user — intentional safety rail
- **No new files**: All changes in 3 existing files (`UserContext.tsx`, `mock.ts`, `NavUser.tsx`)
- **4 curated personas**: Cover all distinct permission tiers in the app (Migration Lead, Technical Lead, Business Owner, viewer/no-role)
- **`DropdownMenuPortal`**: Required to escape sidebar's `overflow-hidden` container and avoid flyout clipping
- **Active persona highlight**: Keyed on `user.name` (not `id`) to correctly highlight "Henry Wilson" persona even though `mockCurrentUser.id` is `'u-current'` vs `'dev-persona-1'`

## Context

- **Visuals:** None
- **References:** `WavesPage.tsx` (role guard pattern), `AppSidebar.tsx` (role-based nav filter), `login-form.tsx` (how login works)
- **Product alignment:** N/A — dev tooling only

## Standards Applied

- None (dev-only tooling, no API surface)
