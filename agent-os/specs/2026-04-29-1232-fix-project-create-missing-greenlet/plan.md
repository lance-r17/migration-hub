# Fix Project Creation API — MissingGreenlet Error

## Context

The `POST /api/v1/projects` endpoint returns HTTP 500 due to a `sqlalchemy.exc.MissingGreenlet` error. After the project is inserted successfully, the router calls `_project_detail(project)`, which invokes the sync helper `compute_stage_progress()`. That helper accesses `project.cloud_resources`, triggering a SQLAlchemy lazy-load inside a synchronous function. In async SQLAlchemy, lazy-loading requires an `await`, which is impossible in sync code, causing the `MissingGreenlet` crash.

## Root Cause

`project_service.create()` returns a freshly-created `Project` instance whose relationships (`cloud_resources`, `risks`, `approvals`, `project_users`, `profile_owner_user`, `wave`) have never been eagerly loaded. When the router's sync helpers (`_project_detail`, `_project_list_item`) access these relationships, SQLAlchemy attempts lazy-loading in a sync context and fails.

Other service methods (`get_all`, `get_by_id`) already use `selectinload` to eager-load relationships, so `list_projects` and `get_project` work correctly.

## Approach

Update `project_service.create()` to query the newly-created project back with the same eager-loading options used by `get_by_id()` (`_project_options()`), ensuring all relationships are populated before the project is passed to sync helper functions in the router.

## Files to Modify

- `backend/app/services/project_service.py` — `create()` function

## Reuse

- `_project_options()` in `backend/app/services/project_service.py` already defines the correct `selectinload` chain for all project relationships.
- `get_by_id()` in the same file demonstrates the exact query pattern to copy.

## Steps

- [x] Replace `await session.refresh(project)` in `create()` with an eager `select(Project).where(Project.id == project.id).options(*_project_options())` query and return the result.
- [x] Verify the fix by reproducing the `POST /api/v1/projects` call (or running the backend and hitting the endpoint).

## Verification

1. Start the backend dev server.
2. Send a `POST /api/v1/projects` request with a payload like `{"id":"xxxx-123456-appone-prod","name":"appone","status":"planning"}`.
3. Confirm the response returns HTTP 201 with a valid `ProjectDetail` JSON body instead of HTTP 500.
