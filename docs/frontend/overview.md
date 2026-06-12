# Frontend Overview

## Directory structure

```
frontend/
├── pnpm-workspace.yaml         # pnpm workspace definition
├── package.json                # @frontend/app
├── src/
│   ├── main.tsx                    # React root — mounts <App> inside <UserProvider>
│   ├── App.tsx                     # BrowserRouter + route definitions + ProtectedRoute
│   ├── pages/
│   │   ├── HomePage.tsx                  # Dashboard — stats, project cards, activity feed
│   │   ├── ProjectsPage.tsx              # All projects table (Platform Migration Lead only)
│   │   ├── ProjectDetailsPage.tsx        # Full project register with all 10 sections
│   │   ├── WavesPage.tsx                 # Wave planning (Platform Migration Lead only)
│   │   ├── LoginPage.tsx                 # Mock SSO login
│   │   ├── EngagementCalendarPage.tsx    # Month calendar of all project engagements
│   │   ├── EngagementNotesPage.tsx       # Read-only engagement notes view
│   │   ├── EngagementNotesEditPage.tsx   # Notion editor for engagement notes (auto-save)
│   │   ├── NoteTemplatesPage.tsx         # Template card gallery
│   │   ├── TemplatePreviewPage.tsx       # Template view/edit with version history
│   │   ├── EmailTemplatesPage.tsx        # Email template list + create/delete
│   │   ├── EmailBuilderPage.tsx          # Visual email template editor
│   │   └── EmailPreviewPage.tsx          # Template preview + Send Test
│   ├── components/
│   │   ├── layout/                 # App shell, sidebar, header, nav
│   │   ├── project/                # Per-section display components
│   │   ├── drawers/                # Right-side edit panels (Sheet-based)
│   │   ├── modals/                 # Modal dialogs (sign-off workflow)
│   │   ├── home/                   # Home page widget components
│   │   ├── shared/                 # Reusable cross-page components
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── audit/                  # Audit log timeline
│   │   ├── engagement/             # Engagement feature components
│   │   │   ├── EngagementDrawer.tsx       # Metadata drawer (slots, participants, Zoom)
│   │   │   ├── MonthCalendar.tsx          # Month-grid with status-coloured pills
│   │   │   └── ConfluenceExportDialog.tsx # Blocks → Confluence XHTML export
│   │   ├── note-template/          # Note template feature components
│   │   │   ├── TemplatePicker.tsx         # Searchable apply-template dialog
│   │   │   ├── SaveTemplateDialog.tsx     # Save notes as template with smart replacements
│   │   │   └── TemplateMetaPanel.tsx      # Name/description/labels/scope form
│   │   └── email-builder/          # Email builder UI
│   │       ├── builder/            # Editor layout, canvas, left/right panels
│   │       │   ├── canvas/         # Row, column, component, toolbar, rich text editor
│   │       │   ├── left-panel/     # Layouts tab, library tab
│   │       │   └── right-panel/    # Config, content, style tabs
│   │       └── preview/            # BrowserContainer, TemplateRenderer
│   ├── hooks/                      # Custom hooks (data + business logic)
│   ├── services/                   # API layer (one file per domain)
│   │   └── noteTemplates.ts        # CRUD + version control for note templates
│   ├── context/
│   │   └── UserContext.tsx         # Auth context
│   ├── types/
│   │   ├── index.ts                # Core domain types
│   │   ├── audit.ts                # Audit log types
│   │   ├── wave.ts                 # Wave + Jira job types
│   │   └── email.ts                # Email template types (EmailTemplate, EmailComponent, etc.)
│   ├── data/
│   │   ├── mock.ts                 # Seed data
│   │   ├── store.ts                # In-memory session store
│   │   ├── emailTemplates.ts       # In-memory email template store
│   │   └── noteTemplates.ts        # Predefined seed templates (global + function-specific)
│   ├── utils/
│   │   └── diff.ts                 # Object diff engine for audit logging
│   └── lib/
│       ├── utils.ts                   # cn() helper
│       ├── noteTemplateUtils.ts       # Block sanitisation, variable resolution, smart replacement
│       ├── bgi-utils.ts               # BGI tree helpers (filter, collectAllIds, findNodeById, prune, promote)
│       └── categoryMilestoneIcons.ts  # Icon map for category milestone Gantt overlay
│
└── packages/
    └── notion-editor/              # @frontend/notion-editor workspace package
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts            # Public API exports
            ├── NotionEditor.tsx    # Block editor root component
            ├── VariableMenu.tsx    # {{variable}} autocomplete
            ├── model.ts            # Block types + helpers (createBlock, cloneBlock)
            ├── SlashMenu.tsx
            ├── Editable.tsx
            ├── InlineToolbar.tsx
            └── …
```

The `frontend/` directory is a **pnpm workspace**. The app (`@frontend/app`) and the editor package (`@frontend/notion-editor`) are resolved locally via `workspace:*` links. Vite follows the symlinks automatically, so HMR and Tailwind class scanning work transparently for code in `packages/`. Install from the `frontend/` root:

```bash
cd frontend
pnpm install
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
- `'Platform Migration Lead'` — sees all projects, accesses `/projects`, `/waves`, and has the second sign-off step
- Other roles — see only their own projects

Feature-level checks happen inside components, not in routes (except `WavesPage` and `ProjectsPage` which have inline role guards).

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
pnpm build   # tsc -b && vite build → dist/
```

TypeScript strict mode is enabled. The build fails on type errors. No `any` escape hatches in production code.

## Docker build & push

See [docker-build-push.md](docker-build-push.md) for building the frontend Docker image and pushing to a Nexus registry.

Quick local build:

```bash
docker build -t migration-hub-frontend:latest .
```

Run locally:

```bash
docker run -d -p 8080:8080 migration-hub-frontend:latest
```

> **Note:** The Docker build uses `npx vite build` directly (skipping `tsc -b`) because the codebase currently has pre-existing TypeScript errors. Fix the type errors to restore `pnpm build` in the Dockerfile.
>
> The workspace requires `pnpm-workspace.yaml`, `.npmrc`, `pnpm-lock.yaml`, and both `package.json` files to be copied into the builder before `pnpm install --frozen-lockfile` is run.
>
> The builder stage installs nginx and copies it (binary + all shared libraries) into the runtime image, so you can use a distroless or hardened runtime. The builder and runtime must use the same C library (musl or glibc).
