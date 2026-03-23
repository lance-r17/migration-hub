# API Service Layer — Shaping Notes

## Scope

Refactor all pages and components to retrieve data via an async service layer instead of directly importing from `src/data/mock.ts`. The FastAPI backend does not exist yet, so services use mock data internally for now. When the backend is ready, only the service layer needs to change — pages and hooks remain unchanged.

## Decisions

- **Strategy:** Async service wrappers — each service function is async and returns mock data today; real `fetch` calls are already written and gated behind a `USE_MOCK` flag. Flipping `VITE_API_BASE_URL` activates the real API path with no code changes.
- **Writes included:** Save operations (editing project sections) also go through the service layer via `updateProject()`.
- **UserContext included:** Current user is also fetched asynchronously via `getCurrentUser()` service, making the pattern consistent.
- **In-memory store:** A `src/data/store.ts` module holds a mutable `structuredClone` of all mock data, so writes persist within a browser session.
- **200ms artificial delay:** Makes loading skeletons visible during development, confirming the pattern works.
- **Optimistic updates in `saveSection`:** Preserves the "instant feedback" UX of the original synchronous `handleSave`. Rolls back on error.

## Context

- **Visuals:** None
- **References:** `src/data/mock.ts`, `src/pages/ProjectDetailsPage.tsx`, `src/context/UserContext.tsx`
- **Product alignment:** Backend is FastAPI (see `agent-os/product/tech-stack.md`); REST endpoints follow `/api/v1/` convention

## Standards Applied

- None (no standards directory exists)
