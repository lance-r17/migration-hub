# Fix Project Creation API — Shaping Notes

## Scope

Fix the `POST /api/v1/projects` endpoint so it returns the created project detail without crashing with `sqlalchemy.exc.MissingGreenlet`.

## Decisions

- **Minimal fix:** Only change `project_service.create()` to eager-load relationships. Do not refactor `_project_detail` or `compute_stage_progress` to async, since that would be a much larger, riskier change.
- **Reuse existing pattern:** Use `_project_options()` and the same query style as `get_by_id()` rather than inventing a new loading strategy.

## Context

- **Visuals:** None
- **References:** `project_service.get_by_id()` demonstrates the correct eager-loading pattern.
- **Product alignment:** N/A — this is a backend stability bug fix.

## Standards Applied

- None — no agent-os standards directory exists for this codebase.
