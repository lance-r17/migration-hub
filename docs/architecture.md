# Architecture

## Overview

Migration Hub is a monorepo with a React SPA frontend and a Python/FastAPI backend. The frontend can run on a client-side mock store (default, no backend needed) or against the real API by setting one environment variable.

```
┌──────────────────────────────────────────────────────┐
│                   Browser (React SPA)                │
│                                                      │
│  Pages → Components → Hooks → Services               │
│                                    │                 │
│                    ┌───────────────┴──────────────┐  │
│                    │  VITE_API_BASE_URL set?       │  │
│                    │  No  → In-memory mock store   │  │
│                    │  Yes → HTTP REST API          │  │
│                    └───────────────┬──────────────┘  │
└────────────────────────────────────┼─────────────────┘
                                     │ JSON / REST
                         ┌───────────▼───────────┐
                         │  FastAPI (Python)      │
                         │  /api/v1/...           │
                         └───────────┬───────────┘
                                     │ SQLAlchemy
                         ┌───────────▼───────────┐
                         │  PostgreSQL            │
                         └───────────────────────┘
                                     │
                         ┌───────────▼───────────┐
                         │  Background jobs       │
                         │  • Jira issue creation │
                         │  • Resource scanning   │
                         └───────────────────────┘
```

## Frontend layers

```
src/
├── pages/          Route-level components (one per URL)
├── components/     Presentational UI — layout, sections, drawers, shared
├── hooks/          Business logic + data fetching (custom hooks)
├── services/       API abstraction (one file per domain)
├── context/        React Context (auth state only)
├── types/          TypeScript interfaces and enums
├── data/           In-memory mock store (session-scoped)
└── utils/          Pure utilities (diff engine, cn())
```

Data flows strictly downward: pages call hooks, hooks call services, services call the store or the HTTP client. Components receive data and callbacks as props; they never call services directly.

## Mock vs. real API

The toggle lives in `frontend/src/services/client.ts`:

```ts
export const USE_MOCK = !import.meta.env.VITE_API_BASE_URL
```

When `USE_MOCK` is `true`, every service function reads/writes `src/data/store.ts` (an in-memory session store seeded from `src/data/mock.ts`) with a 200 ms simulated latency. When `false`, the same function calls the real HTTP API via `apiClient`.

No code changes are needed to switch modes — set `VITE_API_BASE_URL` in `.env.local`.

### Email server exception

`sendTestEmail` in `services/emailService.ts` bypasses the `USE_MOCK` flag entirely when `VITE_EMAIL_SERVER_URL` is set. It calls the local Node.js email relay (`email-server/`) at that URL directly, regardless of whether the rest of the app is in mock mode. This lets real email sending work during frontend-only development without a full backend.

## Authentication

Auth state is managed by `UserContext` (`src/context/UserContext.tsx`):

- On mount it reads `sessionStorage.getItem('auth')` to restore session
- `login(user)` stores the user in state and writes `'true'` to `sessionStorage`
- `logout()` clears both
- `ProtectedRoute` in `App.tsx` redirects unauthenticated requests to `/login`
- Role-based feature gating happens inside individual pages/components using `user.role`

## Routing

Defined in `frontend/src/App.tsx`:

| Route | Component | Guard |
|---|---|---|
| `/login` | `LoginPage` | None |
| `/` | `HomePage` | `ProtectedRoute` |
| `/projects/:id` | `ProjectDetailsPage` | `ProtectedRoute` |
| `/waves` | `WavesPage` | `ProtectedRoute` + role check |
| `/email` | `EmailTemplatesPage` | `ProtectedRoute` |
| `/email/:id/edit` | `EmailBuilderPage` | `ProtectedRoute` |
| `/email/:id/preview` | `EmailPreviewPage` | `ProtectedRoute` |

## State management

There is no global state library. State is local to each hook and flows down via props:

- `useProject(id)` owns the single-project state for `ProjectDetailsPage`
- `useProjects()` owns the project list for `HomePage`
- `useWaves()` owns wave list + mutations for `WavesPage`
- `useCurrentUser()` (from `UserContext`) provides the authenticated user to any component

## Audit logging

Every call to `saveSection()` in `useProject` compares the previous and next values using `diffObjects()` from `src/utils/diff.ts`, classifies the change into an `AuditEventType`, and appends an `AuditLogEntry` to the store. In production, the backend creates these rows as a transaction side-effect — no frontend POST is needed.

## Jira integration

Sign-off by the Platform Migration Lead triggers `createJiraJob()` in `src/services/jiraJobs.ts`. This simulates an async job queue:

1. Immediately — writes a pending job record; sets `project.jiraJobStatus = 'pending'`
2. ~5 seconds — transitions to `'processing'`
3. ~30 seconds — generates a story key and per-resource subtask keys; writes them back to the project and each `CloudResource`

`useProject` polls `getProject(id)` every 5 seconds while `jiraJobStatus` is `'pending'` or `'processing'`, then stops.

## Backend

The FastAPI backend lives in `backend/` and exposes all `/api/v1/...` endpoints the frontend calls.

**Stack:** Python 3.12, FastAPI (async), SQLAlchemy 2.0 (async, `asyncpg` driver), Alembic, PostgreSQL 16.

**Key structural points:**
- 13 SQLAlchemy models — project sections stored as JSONB columns; cloud resources, risks, approvals, and audit entries are separate normalized tables with FK to `projects`
- Project PKs are TEXT (preserves frontend IDs like `PRJ-2024-ALPHA`)
- `config_store` singleton table (key→JSONB) holds survey config, resource survey config, and billing thresholds
- Audit entries are written as a transaction side-effect on every project write — never by the frontend
- Jira job processing uses FastAPI `BackgroundTasks`; stale `processing` jobs are reset to `failed` on startup
- `GET /api/v1/users/me` returns the user identified by `CURRENT_USER_ID` env var — no JWT auth yet

See [backend/overview.md](backend/overview.md), [backend/api.md](backend/api.md), and [backend/database.md](backend/database.md) for full details.
