# Refactor: Survey Spec Updates → Per-Resource `resource_updated` Events

## Context

Survey spec updates should emit one `resource_updated` audit entry per modified resource (matching how risks use per-entity events), not a single bundled `survey_submitted` entry. `resource_updated` is already defined in `AuditLogTimeline.tsx`.

## Task 1: Save spec documentation ✓

## Task 2: Fix `batch_update_resource_specs()` — backend

- One `append_entry(resource_updated)` per resource with changes
- `entityId` = resource.id, `entityLabel` = resource.name
- Plain field labels in `changes` (no resource name prefix)

## Task 3: Fix mock `batchUpdateResourceSpecs()` — frontend

- Loop per resource, call `appendAuditEntryMock(resource_updated)` per modified resource

## Verification

1. 2 resources updated → 2 separate `resource_updated` entries
2. Unchanged resources → no entry
3. Server icon renders in timeline (already configured)
