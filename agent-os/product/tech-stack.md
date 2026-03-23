# Tech Stack

## Frontend

- **Vite** — Build tool and dev server
- **React** — UI framework (via Vite)
- **Tailwind CSS** — Utility-first styling
- **shadcn/ui** — Component library built on Radix UI primitives
- **Lucide Icons** — Icon set

## Backend

- **Python** — Primary backend language
- **FastAPI** — REST API framework with async support and auto-generated OpenAPI docs

## Database

- **PostgreSQL** — Primary relational database
- **Alembic** — Database schema migrations (used with SQLAlchemy)

## Integrations

- **Jira** — Issue tracking; Jira issues are automatically created via background job when a project is signed off
- **Cloud Provider API** — Used by the resource scanning background job to enumerate resources in both source and target availability zones
