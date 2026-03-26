# References

## E2E Implementation Spec

- **Location:** `agent-os/specs/2026-03-25-1000-frontend-e2e-playwright/`
- **Relevance:** The prior spec that implemented the full Playwright test suite — this documentation spec is a direct follow-up

## Key Test Files

- `frontend/playwright.config.ts` — Playwright configuration (webServer, projects, reporter)
- `frontend/e2e/fixtures/auth.fixture.ts` — `authenticatedPage` fixture using `addInitScript`
- `frontend/e2e/tests/` — 6 test suites (auth, navigation, home, cloud-resources, wave-planning, rbac)

## Key Source Files Referenced in Docs

- `frontend/src/contexts/UserContext.tsx` — `AUTH_KEY = 'auth'` (why sessionStorage key is 'auth')
- `frontend/src/data/mock.ts` — in-memory mock store seeded for all tests
- `.github/workflows/e2e.yml` — CI workflow that runs tests on push/PR to main
