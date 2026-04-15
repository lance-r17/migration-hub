# Migration Hub

Migration Hub is a role-based single-page web application that centralizes cloud migration planning and coordination. It gives platform engineering teams and project teams a shared, structured workspace for documenting, tracking, and signing off on readiness across every application being migrated.

## Why it exists

Organizations migrating cloud resources between availability zones lack a centralized tool to coordinate across multiple project teams. Teams need a structured way to document migration readiness; platform teams need full visibility into progress across all projects. Migration Hub provides both in one place.

## Key features

- **Project register** — One card per application, with a 10-section documentation template covering everything from cloud resources to rollback plans
- **Role-based visibility** — Platform team sees all projects; project members see only their own
- **Sign-off workflow** — Multi-role approval (Technical Lead, Business Owner, Platform Migration Lead) that auto-triggers Jira issue creation on completion
- **Wave planning** — Group projects into named migration waves backed by Jira epics; create new waves or import existing ones
- **Email builder** — Visual email template builder with 9 event-driven notification types, multi-column layouts, rich text editing, and browser-based preview with Send Test capability
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
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 16, Alembic migrations |
| Email server | Node.js, Express, Nodemailer |
| Integrations | Jira |

## Repository structure

```
migration-hub/
├── frontend/               # React SPA
│   ├── src/
│   │   ├── pages/          # Route-level page components
│   │   ├── components/     # UI components (layout, project sections, drawers, email builder)
│   │   ├── hooks/          # Custom React hooks (data fetching + business logic)
│   │   ├── services/       # API service layer (mock ↔ real toggle)
│   │   ├── context/        # React context (auth)
│   │   ├── types/          # TypeScript domain types
│   │   ├── data/           # In-memory mock store
│   │   └── utils/          # Utility functions (diff engine, cn())
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── backend/                # Python FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLAlchemy ORM models (13 tables)
│   │   ├── schemas/        # Pydantic v2 request/response schemas
│   │   ├── routers/        # FastAPI route handlers (11 router files)
│   │   ├── services/       # Business logic layer
│   │   └── data/           # Static constants (survey field defs)
│   ├── alembic/            # Database migration scripts
│   ├── scripts/
│   │   ├── seed.py         # Database seeder
│   │   └── seed_data/      # JSON seed files per domain
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── pyproject.toml
├── email-server/           # Minimal SMTP relay server (Express + nodemailer)
│   ├── index.js            # Single POST /api/v1/email-templates/send-test endpoint
│   └── .env.example        # SMTP configuration template
├── agent-os/
│   ├── product/            # Mission, tech stack, roadmap
│   └── specs/              # Feature specs (one folder per feature)
└── docs/                   # Developer documentation (this)
```

## Getting started

See [docs/getting-started.md](docs/getting-started.md) for full setup instructions.

**Quick start (frontend only — mock data):**

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

**Quick start (full stack):**

```bash
# Terminal 1 — database + backend
cd backend
docker compose up -d db        # PostgreSQL on :5432
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload  # FastAPI on :8000

# Terminal 2 — frontend
cd frontend
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev                    # http://localhost:5173
```

## Routes

| Path | Page | Access |
|---|---|---|
| `/login` | Login (mock SSO) | Public |
| `/` | Home dashboard | Authenticated |
| `/projects/:id` | Project details | Authenticated |
| `/waves` | Wave planning | Platform Migration Lead only |
| `/email` | Email templates | Authenticated |
| `/email/:id/edit` | Email builder | Authenticated |
| `/email/:id/preview` | Email preview | Authenticated |

## Environment variables

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | _(empty)_ | Base URL of the backend API. Leave empty to use mock data. |
| `VITE_EMAIL_SERVER_URL` | _(empty)_ | URL of the local email relay server. Set to `http://localhost:3001` to enable real email sending from the Send Test button. |

When `VITE_API_BASE_URL` is empty, all service calls go to the in-memory mock store. Set it to `http://localhost:8000` to switch to the real backend with no code changes.

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://hub:hub_dev_secret@localhost/migration_hub` | PostgreSQL connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `CURRENT_USER_ID` | `u-current` | User ID returned by `GET /users/me` (no auth system yet) |
| `JIRA_BASE_URL` | _(empty)_ | Jira instance URL |
| `JIRA_API_TOKEN` | _(empty)_ | Jira API token |
| `JIRA_USER_EMAIL` | _(empty)_ | Email for Jira API auth |
| `ENVIRONMENT` | `development` | `development` or `production` |

See [docs/getting-started.md](docs/getting-started.md) for full setup including the email server.

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
