# Mock Sync Status Consistency — Shaping Notes

## Scope

Two related data quality fixes to `frontend/src/data/mock.ts`:

1. **Consistency fix**: Pre-sign-off projects (`in-progress`, `blocked`) must not have any resource with `syncStatus: 'synced'`, since the access control layer now prevents "Mark Sync Completed" before sign-off. Affected projects: PRJ-2024-ALPHA (8 resources fixed), M-77122 (1 resource fixed).

2. **Data enrichment**: Project M-11029 (`signed-off`) only had 2 resources, both already synced. Added 4 more resources (`out-of-sync` ×2, `provisioning` ×1, `synced` ×1) across different categories so the post-sign-off "Mark Sync Completed" flow can be exercised in the UI.

## Decisions

- Changed `synced` → `out-of-sync` or `provisioning` (alternating, to keep a realistic mix).
- New M-11029 resources use realistic auth-service names and specs consistent with the project theme (OAuth / identity).
- `completed` projects: M-88271 has no currentInfrastructure populated — left untouched (no resources to fix).

## Context

- **Visuals:** None
- **References:** Existing mock resource blocks in mock.ts
- **Product alignment:** N/A
