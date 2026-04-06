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

### E2E tests

```bash
# First time: install Chromium browser
npx playwright install chromium

# Run all tests (headless, spins up Vite automatically)
npm run test:e2e

# Interactive UI mode (useful for debugging)
npm run test:e2e:ui
```

46 tests cover auth, navigation, wave planning, cloud resources, and RBAC.
See [docs/frontend/testing.md](frontend/testing.md) for the full test reference.

## Environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | _(empty)_ | Base URL for the backend API. Leave empty to run on mock data. |
| `VITE_EMAIL_SERVER_URL` | _(empty)_ | URL of the local email relay server. Set to `http://localhost:3001` when running the email server. |

**Mock mode (default):** leave `VITE_API_BASE_URL` unset. All data comes from the in-memory store seeded by `src/data/mock.ts`. No database or backend needed.

**Real API mode:** set `VITE_API_BASE_URL=http://localhost:8000` (or wherever the FastAPI server is running).

## Email server (optional)

The email server enables real SMTP email sending from the "Send Test" button in email template previews. It runs independently of the frontend.

### Setup

```bash
cd email-server
npm install
cp .env.example .env   # fill in your SMTP credentials
```

`.env` settings:

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port — `587` for TLS, `465` for SSL |
| `SMTP_SECURE` | `true` for port 465 (SSL), `false` for 587 (TLS) |
| `SMTP_USER` | Sender email address |
| `SMTP_PASS` | App password or SMTP password |
| `SMTP_FROM` | Display name + address (e.g. `Migration Hub <you@example.com>`) |

**Gmail quick start:** enable 2-factor auth, generate an App Password at `myaccount.google.com/apppasswords`, and use it as `SMTP_PASS`.

### Run

```bash
npm run dev   # starts on http://localhost:3001
```

Then add `VITE_EMAIL_SERVER_URL=http://localhost:3001` to `frontend/.env.local`. The rest of the app remains in mock mode.

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
