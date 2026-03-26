# Frontend E2E Testing — Full Playwright Automation

## Context

Migration Hub has zero testing infrastructure today (no test framework, no CI). The goal is to add fully automated Playwright E2E tests covering all user flows — auth, navigation, wave planning, cloud resource CRUD, and RBAC — with GitHub Actions running tests on every PR and push to `main`.

**Key findings:**
- Auth state: `sessionStorage.setItem('auth', 'true')` — simple boolean flag (`AUTH_KEY = 'auth'`, `UserContext.tsx:6`)
- Mock mode is the default when `VITE_API_BASE_URL` is unset — tests run against the in-memory store
- 4 routes: `/login`, `/`, `/projects/:id`, `/waves` (all protected except `/login`)
- Vite runs on port 5173 (no custom port set)
- `mockCurrentUser` is always `Platform Migration Lead` — RBAC tests verify positive role access; negative tests noted as future scope

---

## Task 1: Save spec documentation ✓

Created `agent-os/specs/2026-03-25-1000-frontend-e2e-playwright/` with plan.md, shape.md, references.md.

---

## Task 2: Install Playwright and configure

- `frontend/package.json` — add `@playwright/test` devDep + test scripts
- `frontend/playwright.config.ts` — webServer targeting `vite dev` on port 5173

---

## Task 3: Add data-testid to key components

- `frontend/src/components/layout/AppShell.tsx` — `data-testid="app-shell"` on `<main>`

---

## Task 4: Auth fixture + auth/navigation tests

- `frontend/e2e/fixtures/auth.fixture.ts` — sessionStorage injection fixture
- `frontend/e2e/tests/auth.spec.ts` — 8 tests
- `frontend/e2e/tests/navigation.spec.ts` — 8 tests

---

## Task 5: Home + cloud-resources tests

- `frontend/e2e/tests/home.spec.ts` — 6 tests
- `frontend/e2e/tests/cloud-resources.spec.ts` — 8 tests

---

## Task 6: Wave planning + RBAC tests

- `frontend/e2e/tests/wave-planning.spec.ts` — 10 tests
- `frontend/e2e/tests/rbac.spec.ts` — 6 tests

---

## Task 7: GitHub Actions CI

- `.github/workflows/e2e.yml` — installs, runs tests, uploads report artifact
