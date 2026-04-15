# Fix currentInfrastructure Audit Changes — Shaping Notes

## Scope

Make the `currentInfrastructure` section update create meaningful audit entries when resources are added, removed, or have spec changes. Currently always `changes: []`.

## Decisions

- Backend only: one file (`project_service.py`)
- Three change types: Added, Removed, Specs changed
- Specs diff reuses existing `_diff_section()` helper
- No entry created when nothing changed (saves with identical resources)
- Resource matching by ID

## Context

- **Visuals:** User shared API logs confirming `changes: []` for currentInfrastructure
- **Root cause:** `_replace_resources()` deletes-then-reinserts; old data gone by the time audit is written — must snapshot first
