# References

## `_replace_resources()` — `project_service.py:315`

- **Relevance:** Existing full-replace resource mutation — the pattern this feature complements
- **Key patterns:** delete-all then insert-all; `_classify_resource_changes()` for diffs; one `audit_service.append_entry()` per changed resource

## `batch_update_resource_specs()` — `project_service.py:474`

- **Relevance:** Existing partial-update for specs only — shows the precedent for non-destructive resource writes
- **Key patterns:** iterate updates, `session.get(CloudResource, id)`, merge specs dict, `_diff_section()` for audit

## `CloudResourcePatch` — `backend/app/schemas/cloud_resource.py:37`

- **Relevance:** Existing all-optional snake_case schema covering updatable resource fields
- **Key pattern:** `ResourceUpsertItem` is `CloudResourcePatch` plus an optional `id` field and `migration_completed`
