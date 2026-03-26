# Documentation Update — Shaping Notes

## Scope

Update documentation and `.gitignore` to reflect the Playwright E2E test suite that was added in the previous session.

## Decisions

- **Complete README rewrite**: The existing `frontend/README.md` was the default Vite template — zero project-specific information. Replaced entirely with a project-specific quick-start, scripts table, env vars, and E2E test section.
- **New `docs/frontend/testing.md`**: Rather than cramming testing info into the existing frontend docs, a dedicated file was created. This mirrors the pattern of `hooks.md`, `services.md`, etc.
- **`getting-started.md` insert point**: The E2E section was placed directly after the `### Lint` section so all frontend dev scripts are grouped together.
- **`.gitignore` patterns**: Added four patterns — `playwright-report/`, `test-results/`, `blob-report/`, `.playwright/` — covering Playwright's default output locations plus the blob reporter output used in sharded runs.
- **No root README change**: The root `README.md` already links to `docs/` for full documentation; no change needed there.

## Context

- **Visuals:** None
- **References:** `agent-os/specs/2026-03-25-1000-frontend-e2e-playwright/` (previous E2E spec)
- **Product alignment:** N/A
