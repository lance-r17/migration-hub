# Migration Hub

Migration Hub is a role-based single-page web application that centralizes cloud migration planning and coordination. It gives platform engineering teams and project teams a shared, structured workspace for documenting, tracking, and signing off on readiness across every application being migrated.

## Why it exists

Organizations migrating cloud resources between availability zones lack a centralized tool to coordinate across multiple project teams. Teams need a structured way to document migration readiness; platform teams need full visibility into progress across all projects. Migration Hub provides both in one place.

## Key features

- **Project register** — One card per application, with a 10-section documentation template covering everything from cloud resources to rollback plans
- **Role-based visibility** — Platform team sees all projects; project members see only their own
- **Sign-off workflow** — Multi-role approval (Technical Lead, Business Owner, Platform Migration Lead) that auto-triggers Jira issue creation on completion
- **Wave planning** — Group projects into named migration waves backed by Jira epics; create new waves or import existing ones
- **Audit trail** — Every field change is logged with actor, timestamp, and before/after values
- **Mock-first development** — Fully functional without a backend; set one env var to switch to real API

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, Vite 8 |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4, shadcn/ui (Radix UI) |
| Animation | Motion |
| Notifications | Sonner |
| Backend (planned) | Python, FastAPI |
| Database (planned) | PostgreSQL + Alembic |
| Integrations | Jira |

## Repository structure

```
migration-hub/
├── frontend/               # React SPA (the active application)
│   ├── src/
│   │   ├── pages/          # Route-level page components
│   │   ├── components/     # UI components (layout, project sections, drawers)
│   │   ├── hooks/          # Custom React hooks (data fetching + business logic)
│   │   ├── services/       # API service layer (mock ↔ real toggle)
│   │   ├── context/        # React context (auth)
│   │   ├── types/          # TypeScript domain types
│   │   ├── data/           # In-memory mock store
│   │   └── utils/          # Utility functions (diff engine, cn())
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── agent-os/
│   ├── product/            # Mission, tech stack, roadmap
│   └── specs/              # Feature specs (one folder per feature)
└── docs/                   # Developer documentation (this)
```

## Getting started

See [docs/getting-started.md](docs/getting-started.md) for full setup instructions.

**Quick start (frontend only):**

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

No environment variable setup is needed for local development — the app runs entirely on mock data by default.

## Routes

| Path | Page | Access |
|---|---|---|
| `/login` | Login (mock SSO) | Public |
| `/` | Home dashboard | Authenticated |
| `/projects/:id` | Project details | Authenticated |
| `/waves` | Wave planning | Platform Migration Lead only |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | _(empty)_ | Base URL of the backend API. Leave empty to use mock data. |

When `VITE_API_BASE_URL` is empty, all service calls go to the in-memory mock store. Set it to the FastAPI server URL (e.g. `http://localhost:8000`) to switch to the real backend with no code changes.

## Documentation

| Doc | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Full system architecture — frontend, backend, database, Jira |
| [docs/getting-started.md](docs/getting-started.md) | Prerequisites, install, run, environment setup |
| [docs/frontend/overview.md](docs/frontend/overview.md) | Frontend structure, routing, auth, mock vs real API |
| [docs/frontend/hooks.md](docs/frontend/hooks.md) | Custom React hooks reference |
| [docs/frontend/services.md](docs/frontend/services.md) | Service layer — API methods, endpoints, mock behavior |
| [docs/frontend/components.md](docs/frontend/components.md) | Component inventory — layout, pages, drawers, shared |
| [docs/frontend/best-practices.md](docs/frontend/best-practices.md) | Patterns and conventions |
| [docs/shared/data-model.md](docs/shared/data-model.md) | Core domain types shared between frontend and backend |
| [docs/shared/jira-integration.md](docs/shared/jira-integration.md) | Jira integration — epic/story/subtask flow, job queue |
| [docs/backend/overview.md](docs/backend/overview.md) | Backend structure (Python/FastAPI) |
| [docs/backend/api.md](docs/backend/api.md) | REST API endpoint reference |
| [docs/backend/database.md](docs/backend/database.md) | Database schema and Alembic migrations |
