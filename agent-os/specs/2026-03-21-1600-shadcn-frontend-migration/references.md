# References for shadcn Frontend Migration

## Source: shadcn Template

- **Location:** `/workspaces/migration-hub/shadcn/`
- **Relevance:** The source of all layout patterns, CSS variables, and UI components being applied
- **Key patterns to borrow:**
  - `src/index.css` — Tailwind v4 OKLch color system and CSS variable structure
  - `src/components/app-sidebar.tsx` — Collapsible sidebar layout
  - `src/components/site-header.tsx` — Fixed header with SidebarTrigger
  - `src/components/nav-main.tsx`, `nav-secondary.tsx`, `nav-user.tsx` — Sidebar nav sections
  - `src/components/theme-provider.tsx` — Dark/light theme with localStorage + keyboard shortcut
  - `src/components/ui/` — All 22 shadcn/ui component primitives
  - `src/hooks/use-mobile.ts` — Mobile breakpoint detection hook
  - `vite.config.ts` — @tailwindcss/vite plugin setup

## Target: Migration Hub Frontend

- **Location:** `/workspaces/migration-hub/frontend/`
- **Relevance:** The app being migrated — all routes, data, types, and business logic stay intact
- **Key files preserved unchanged:**
  - `src/types/index.ts` — All TypeScript types
  - `src/data/mock.ts` — Mock project data
  - `src/lib/utils.ts` — cn() utility
  - `src/pages/` — HomePage and ProjectDetailsPage
  - `src/components/home/` — All home page components (re-coloured only)
  - `src/components/project/` — All project detail components (re-coloured only)
  - `src/components/modals/` — SignOffModal and ApprovalTimeline (re-coloured only)
