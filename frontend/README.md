# Migration Hub — Frontend

React + TypeScript SPA for managing cloud migration projects.
Built with Vite, shadcn/ui, React Router v6, and TanStack Query.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Mock mode is active by default (no backend needed). Any credentials work on the login screen.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production bundle → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Run Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Run Playwright with interactive UI |
| `npm run test:e2e:report` | Open last test HTML report |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | _(empty)_ | Backend API base URL. Leave empty for mock mode. |

## E2E tests

Tests live in `e2e/tests/` and use [Playwright](https://playwright.dev).
The `webServer` config auto-starts Vite before running tests.

```bash
# First time only — install Chromium
npx playwright install chromium

npm run test:e2e
```

46 tests across 6 suites: auth, navigation, home, cloud-resources, wave-planning, rbac.

See [`docs/frontend/testing.md`](../docs/frontend/testing.md) for the full testing guide.

## Project docs

Full documentation lives in [`docs/`](../docs/README.md).
