# Frontend E2E Testing

Playwright E2E tests cover all user flows — auth, navigation, wave planning, cloud resource CRUD, and RBAC.

## Test structure

```
frontend/
├── playwright.config.ts             # Playwright config (webServer, reporter, projects)
└── e2e/
    ├── fixtures/
    │   └── auth.fixture.ts          # authenticatedPage fixture
    └── tests/
        ├── auth.spec.ts             # Login, logout, redirect behaviour (7 tests)
        ├── navigation.spec.ts       # Sidebar, breadcrumbs, project navigation (8 tests)
        ├── home.spec.ts             # Dashboard metrics and project cards (6 tests)
        ├── cloud-resources.spec.ts  # Resource table, edit drawer, audit log (8 tests)
        ├── wave-planning.spec.ts    # Create/import wave, calendar (10 tests)
        └── rbac.spec.ts             # Role-based access, sign-off flow (7 tests)
```

## Running tests

```bash
cd frontend

# First time: install Chromium
npx playwright install chromium

# Run all tests (headless, Vite starts automatically)
pnpm test:e2e

# Interactive UI mode (recommended for debugging)
pnpm test:e2e:ui

# View last HTML report
pnpm test:e2e:report
```

### Interactive UI in a dev container

`pnpm test:e2e:ui` requires a virtual display. The dev container includes `xvfb`, so the
command works without a display server. After a container rebuild, `xvfb-run` is available and
the script will launch without crashing.

For the best interactive experience, use the
[Playwright VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)
(installed automatically in the dev container). It provides a test explorer panel that runs
individual tests and shows results without needing a visible display.

## Auth fixture

All test files import from `../fixtures/auth.fixture` which provides the `authenticatedPage` fixture.
The fixture calls `page.addInitScript` to set `sessionStorage.setItem('auth', 'true')` before any
navigation — matching `AUTH_KEY = 'auth'` in `src/context/UserContext.tsx`.

```typescript
import { test, expect } from '../fixtures/auth.fixture'

test('example', async ({ authenticatedPage: page }) => {
  await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
})
```

## Mock mode

Tests run against the in-memory mock store (default when `VITE_API_BASE_URL` is unset).
Mock data is seeded in `src/data/mock.ts`. The mock always returns `Platform Migration Lead`
as the current user — RBAC tests verify positive role access only.

## CI

GitHub Actions runs tests on every push and PR to `main` via `.github/workflows/e2e.yml`.
The HTML report is uploaded as an artifact (`playwright-report`) and retained for 30 days.

## Known patterns and gotchas

| Scenario | Solution |
|----------|----------|
| SiteHeader renders duplicate `<h1>` | Scope heading queries to `[data-testid="app-shell"]` |
| ProjectCard uses `onClick+useNavigate` (no `<a>` tags) | Use `page.locator('button').filter({ hasText: 'View Details' })` |
| react-day-picker hover causes DOM detachment | Use `el.evaluate((el) => el.click())` for end-date selection |
| Async mock data (200 ms delay) | `await expect(firstRow).toBeVisible({ timeout: 10000 })` before counting rows |
| Toast notification matches wave name | Use `getByText('...', { exact: true })` to target table row only |

## Logic verification scripts

Pure calculation logic that is hard to exercise fully through UI tests (e.g. project scoring) can be validated with a standalone script run via `pnpm dlx tsx`:

```bash
cd frontend
pnpm dlx tsx scripts/verify-scoring.ts
```

The script imports the mock data and scoring utilities, asserts expected scores for known projects, and exercises synthetic boundary cases (ECS counts, data volume thresholds, MaxCompute counts, tier mappings, and numeric driver thresholds).