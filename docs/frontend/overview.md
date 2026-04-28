# Frontend Overview

## Directory structure

```
frontend/src/
├── main.tsx                    # React root — mounts <App> inside <UserProvider>
├── App.tsx                     # BrowserRouter + route definitions + ProtectedRoute
├── pages/
│   ├── HomePage.tsx            # Dashboard — stats, project cards, activity feed
│   ├── ProjectDetailsPage.tsx  # Full project register with all 10 sections
│   ├── WavesPage.tsx          # Wave planning (Platform Migration Lead only)
│   ├── LoginPage.tsx          # Mock SSO login
│   ├── EmailTemplatesPage.tsx  # Email template list + create/delete
│   ├── EmailBuilderPage.tsx    # Visual email template editor
│   └── EmailPreviewPage.tsx    # Template preview + Send Test
├── components/
│   ├── layout/                 # App shell, sidebar, header, nav
│   ├── project/                # Per-section display components
│   ├── drawers/                # Right-side edit panels (Sheet-based)
│   ├── modals/                 # Modal dialogs (sign-off workflow)
│   ├── home/                   # Home page widget components
│   ├── shared/                 # Reusable cross-page components
│   ├── ui/                     # shadcn/ui primitives
│   ├── audit/                  # Audit log timeline
│   └── email-builder/          # Email builder UI
│       ├── builder/            # Editor layout, canvas, left/right panels
│       │   ├── canvas/         # Row, column, component, toolbar, rich text editor
│       │   ├── left-panel/     # Layouts tab, library tab
│       │   └── right-panel/    # Config, content, style tabs
│       └── preview/            # BrowserContainer, TemplateRenderer
├── hooks/                      # Custom hooks (data + business logic)
├── services/                   # API layer (one file per domain)
├── context/
│   └── UserContext.tsx         # Auth context
├── types/
│   ├── index.ts                # Core domain types
│   ├── audit.ts                # Audit log types
│   ├── wave.ts                 # Wave + Jira job types
│   └── email.ts                # Email template types (EmailTemplate, EmailComponent, etc.)
├── data/
│   ├── mock.ts                 # Seed data
│   ├── store.ts                # In-memory session store
│   └── emailTemplates.ts       # In-memory email template store
├── utils/
│   └── diff.ts                 # Object diff engine for audit logging
└── lib/
    └── utils.ts                # cn() helper
```

## Path alias

`@/` maps to `src/`. Always use the alias for imports across directories:

```ts
import { useProject } from '@/hooks/use-projects'
import type { Project } from '@/types'
```

## Routing

Defined in `src/App.tsx`. `ProtectedRoute` checks `isAuthenticated` from `useCurrentUser()`; unauthenticated requests redirect to `/login`.

See [shared/sso-configuration.md](../shared/sso-configuration.md) for auth flow diagrams and environment variables.

## Authentication

`UserContext` (`src/context/UserContext.tsx`) is the single source of auth truth. Session is persisted in `sessionStorage` under the key `'auth'`. Three auth modes are supported (see SSO configuration for details):

1. **Custom OAuth** — backend-issued JWT stored in `sessionStorage`
2. **Standard OIDC** — PKCE flow via `oidc-client-ts`
3. **Mock auth** — no IdP; login always succeeds as the seeded dev user

## Role-based access

`user.role` drives feature gating. Current roles in the mock data:
- `'Platform Migration Lead'` — sees all projects, accesses `/waves`, and has the second sign-off step
- Other roles — see only their own projects

Feature-level checks happen inside components, not in routes (except `WavesPage` which has an inline role guard).

## Mock vs. real API

All service files share one toggle:

```ts
// src/services/client.ts
export const USE_MOCK = !import.meta.env.VITE_API_BASE_URL
```

Set `VITE_API_BASE_URL` in `.env.local` to point at a real backend. Nothing else changes.

## Styling conventions

- All class composition goes through `cn()` from `src/lib/utils.ts` — it merges Tailwind classes safely using `clsx` + `tailwind-merge`
- Dark mode is handled by `next-themes`; use `dark:` variants instead of manual theme detection
- Animations use the `motion` library for entrance effects on cards

## Build

```bash
npm run build   # tsc -b && vite build → dist/
```

TypeScript strict mode is enabled. The build fails on type errors. No `any` escape hatches in production code.
