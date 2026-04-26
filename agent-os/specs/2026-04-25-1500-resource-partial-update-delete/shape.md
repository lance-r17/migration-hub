# Resource Partial Update and Bulk Delete — Shaping Notes

## Scope

Two new endpoints that complement the existing full-replace `PATCH /sections/currentInfrastructure`:

1. `PATCH /projects/:id/resources` — upsert specific resources (update by ID, create if no ID), leaving all other resources untouched
2. `DELETE /projects/:id/resources` — delete specific resources by internal ID list

## Decisions

- **Upsert semantics for PATCH**: items with `id` → partial field update (null fields skipped); items without `id` → create new resource. Chosen over update-only because the create path costs nothing to add and avoids a separate endpoint.
- **snake_case for new schemas**: consistent with all existing typed backend schemas (`CloudResourceOut`, `CloudResourceCreate`, `CloudResourcePatch`). Unlike the raw-dict path in `_replace_resources` which uses camelCase because it comes through `SectionPatch.value: Any`.
- **Silently skip unknown IDs**: both endpoints skip IDs not found in the project rather than erroring. Safer for automation scripts that may have stale IDs.
- **Return `ProjectDetail`**: both endpoints return the full updated project (not `204 No Content`) so callers see the new resource list without a separate fetch.
- **No migration**: pure service + router changes; no new DB columns.
- **`_RESOURCE_LABEL_MAP`**: added module-level to cover all updatable columns for audit diffs. Existing `_RESOURCE_FIELD_MAP` only covers 5 camelCase keys used in the full-replace diff.

## Context

- **Visuals:** None
- **References:** `_replace_resources()` in `project_service.py` — existing resource mutation pattern; `batch_update_resource_specs()` — existing partial-update pattern for specs
- **Product alignment:** Supports service account automation use case where callers should not need to fetch full resource state before writing
