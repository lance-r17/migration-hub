# Cloud Resource needMigration Edit — Shaping Notes

## Scope

Add a `needMigration` boolean flag to `CloudResource`. Teams use this to exclude resources from migration scope (e.g., resources being decommissioned or staying in-place). Clicking a table row opens a detail drawer where the flag can be toggled. During active migration phases, the drawer also exposes a "Mark Sync Completed" action.

## Decisions

- `needMigration` is optional (default `true`); `undefined` is treated as needing migration
- Drawer is **read-only** except for the `needMigration` checkbox — data integrity is preserved since resources come from discovery scans
- "Mark Sync Completed" sets `syncStatus: 'synced'` and is gated to `in-progress` or `migrating` project status
- Excluded resources (`needMigration === false`) render strikethrough + `opacity-40` on the full table row

## Context

- **Visuals:** None provided
- **References:** `RiskEditDrawer.tsx` (list-item edit pattern), `NetworkConfigurationDrawer.tsx` (drawer-within-section pattern)
- **Product alignment:** Supports migration readiness tracking — teams need to mark resources as out-of-scope before sign-off

## Standards Applied

None defined in `agent-os/standards/` at time of writing.
