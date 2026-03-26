# Frontend E2E Playwright — Shaping Notes

## Scope

Full Playwright E2E test automation for Migration Hub SPA. Zero existing test infrastructure — this spec establishes the complete testing foundation.

**Deliverables:**
- Playwright installed and configured
- `data-testid` attributes added to key layout components
- 6 test suites (44+ test cases) covering all major user flows
- GitHub Actions CI workflow running on every PR and push to `main`

## Decisions

- **Framework**: Playwright only (not Vitest/unit tests) — user requested full E2E coverage
- **Browser**: Chromium only in CI for speed; can expand to webkit/firefox later
- **Auth strategy**: Inject `sessionStorage.setItem('auth', 'true')` via `addInitScript` before page navigation — mirrors the `AUTH_KEY = 'auth'` pattern in `UserContext.tsx`
- **Mock mode**: Default (no `VITE_API_BASE_URL` set) — all tests run against in-memory store
- **webServer**: Playwright spins up `vite dev` automatically; reuses running server locally
- **RBAC negative tests**: Deferred — mock always returns Platform Migration Lead, so tests verify positive role assertions only

## Context

- **Visuals:** None
- **References:** `UserContext.tsx`, `App.tsx`, `WavesPage.tsx`, `ProjectDetailsPage.tsx`, `SignOffModal.tsx`
- **Product alignment:** N/A (infrastructure improvement)

## Key Test Data

- `PRJ-2024-ALPHA` — status `in-progress`, Platform Migration Lead approval `pending` → sign-off enabled
- `M-11029` — status `signed-off` → sign-off not available
- `M-88271` — status `planning`
- `M-77122` — status `blocked`
- Mock current user: id `u-current`, role `Platform Migration Lead`

## Standards Applied

None (no agent-os/standards/ directory in this project)
