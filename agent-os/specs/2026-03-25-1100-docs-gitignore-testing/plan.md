# Documentation & .gitignore Update — Post E2E Integration

## Context

The Playwright E2E test suite (46 tests, all passing) has been integrated. This spec captures the follow-up work to bring documentation and repo hygiene in line with the new testing infrastructure.

## Tasks

1. **Save spec docs** — this folder
2. **`frontend/.gitignore`** — add `playwright-report/`, `test-results/`, `blob-report/`, `.playwright/`
3. **`frontend/README.md`** — replace Vite boilerplate with project-specific content
4. **`docs/frontend/testing.md`** — new dedicated E2E testing reference
5. **`docs/getting-started.md`** — add E2E test section after Lint
6. **`docs/README.md`** — add `frontend/testing.md` row to doc index

## Files modified

| File | Change |
|------|--------|
| `frontend/.gitignore` | Added Playwright output patterns |
| `frontend/README.md` | Complete rewrite — project-specific content |
| `docs/getting-started.md` | Added E2E test section |
| `docs/README.md` | Added `frontend/testing.md` row |

## Files created

- `docs/frontend/testing.md` — dedicated E2E testing reference
- `agent-os/specs/2026-03-25-1100-docs-gitignore-testing/` — this spec folder
