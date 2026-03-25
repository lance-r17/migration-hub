# Getting Started

## Prerequisites

- Node.js 20+ and npm
- Git

For full-stack development (when the backend exists):
- Python 3.11+
- PostgreSQL 15+

## Frontend (current)

### Install

```bash
cd frontend
npm install
```

### Run the dev server

```bash
npm run dev
```

The app starts at `http://localhost:5173` (or the port Vite selects). It binds to all interfaces (`--host`) so it works inside Docker / dev containers.

### Build for production

```bash
npm run build      # type-check + Vite bundle → dist/
npm run preview    # preview the production build locally
```

### Lint

```bash
npm run lint
```

## Environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | _(empty)_ | Base URL for the backend API. Leave empty to run on mock data. |

**Mock mode (default):** leave `VITE_API_BASE_URL` unset. All data comes from the in-memory store seeded by `src/data/mock.ts`. No database or backend needed.

**Real API mode:** set `VITE_API_BASE_URL=http://localhost:8000` (or wherever the FastAPI server is running).

## Login

In mock mode, any credentials work. The login form accepts an email and password; they are not validated against real credentials. The mock always returns the same "current user" from `src/data/mock.ts`.

## Dev container

A `.devcontainer/` configuration is included. If you open the repo in VS Code with the Dev Containers extension (or in GitHub Codespaces), the environment is set up automatically.

## Full stack (when backend is available)

> The backend does not exist yet. This section describes the intended setup.

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
```
