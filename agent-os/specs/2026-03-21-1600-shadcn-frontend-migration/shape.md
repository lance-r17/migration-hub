# shadcn Frontend Migration — Shaping Notes

## Scope

Apply the layout and styles from `shadcn/` to `frontend/`. This is a full-stack UI migration:
- Upgrade Tailwind CSS v3 → v4
- Replace Material Design 3 color system with shadcn neutral OKLch palette
- Replace bespoke layout (TopNav + Sidebar + MobileNav) with shadcn collapsible sidebar
- Replace all hand-rolled shared components with shadcn/ui primitives
- All routing, page content, data, and types are preserved

## Decisions

- **Colors:** Adopt shadcn neutral OKLch palette (drop the Architectural Ledger MD3 tokens)
- **Tailwind:** Upgrade v3 → v4 (config moves from tailwind.config.js into index.css CSS variables)
- **Component scope:** Full migration — shared + layout components replaced with shadcn/ui primitives
- **Font:** Replace Inter (Google Fonts CDN) with Geist Variable (@fontsource-variable/geist)
- **Mobile nav:** Replaced by shadcn sidebar's offcanvas Sheet mode (no separate MobileNav)
- **Tertiary color:** No shadcn semantic token for "success green" — use Tailwind `emerald-*` classes
- **Toast:** Replace custom Toast.tsx with sonner

## Context

- **Visuals:** None provided — match shadcn/ visual style
- **References:** `shadcn/` directory — the source of truth for layout/styles
- **Product alignment:** Migration Hub SPA — all routes, data model, and business logic preserved

## Standards Applied

N/A — no agent-os standards were identified as directly applicable to this pure UI migration.
