# Migration Hub

Migration Hub is a role-based single-page web application that centralizes cloud migration planning and coordination. It gives platform engineering teams and project teams a shared, structured workspace for documenting, tracking, and signing off on readiness across every application being migrated.

## Why it exists

Organizations migrating cloud resources between availability zones lack a centralized tool to coordinate across multiple project teams. Teams need a structured way to document migration readiness; platform teams need full visibility into progress across all projects. Migration Hub provides both in one place.

## Key features

- **Project register** — One card per application, with a 10-section documentation template covering everything from cloud resources to rollback plans
- **Role-based visibility** — Platform team sees all projects; project members see only their own
- **Sign-off workflow** — Multi-role approval (Technical Lead, Business Owner, Platform Migration Lead) that auto-triggers Jira issue creation on completion
- **Wave planning** — Group projects into named migration waves backed by Jira epics; create new waves or import existing ones
- **Email builder** — Visual email template builder with event-driven notification types, multi-column layouts, rich text editing, and browser-based preview with Send Test capability
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
├── backend/                # Python FastAPI backend
├── email-server/           # Minimal SMTP relay server
├── docs/                   # Developer documentation
└── agent-os/               # Product specs and mission docs
```

## Quick start

**Frontend only (mock data, no backend needed):**

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

**Full stack:**

```bash
# Terminal 1 — database + backend
cd backend
docker compose up -d db
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
```

See [docs/getting-started.md](docs/getting-started.md) for detailed setup, environment variables, and troubleshooting.

## Documentation

| Doc | Contents |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | Prerequisites, install, run, environment variables |
| [docs/architecture.md](docs/architecture.md) | System architecture — data flow, auth, state management |
| [docs/shared/sso-configuration.md](docs/shared/sso-configuration.md) | Authentication — Custom OAuth, OIDC, mock auth, AD group sync |
| [docs/shared/data-model.md](docs/shared/data-model.md) | Core domain types (TypeScript / Pydantic) |
| [docs/shared/jira-integration.md](docs/shared/jira-integration.md) | Jira integration — epics, stories, sub-tasks, change requests |
| **Frontend** | |
| [docs/frontend/overview.md](docs/frontend/overview.md) | Structure, routing, auth, mock vs real API |
| [docs/frontend/hooks.md](docs/frontend/hooks.md) | Custom React hooks reference |
| [docs/frontend/services.md](docs/frontend/services.md) | Service layer — API methods and endpoints |
| [docs/frontend/components.md](docs/frontend/components.md) | Component inventory |
| [docs/frontend/best-practices.md](docs/frontend/best-practices.md) | Patterns and conventions |
| **Backend** | |
| [docs/backend/overview.md](docs/backend/overview.md) | Backend structure and design principles |
| [docs/backend/api.md](docs/backend/api.md) | REST API endpoint reference |
| [docs/backend/database.md](docs/backend/database.md) | Database schema and migrations |
