# Logo Component — Shaping Notes

## Scope

Extract a reusable `Logo` component that renders `src/assets/vite.svg`. Use it in the sidebar header to replace the generic LayersIcon.

## Decisions

- Component lives in `src/components/shared/` alongside other shared UI
- Accepts optional `className` for sizing/styling at call sites
- Single source of truth for the app logo going forward

## Context

- **Visuals:** `src/assets/vite.svg`
- **References:** `src/components/layout/AppSidebar.tsx`
- **Product alignment:** N/A — branding/polish
