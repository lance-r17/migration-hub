# Mock targetStatus Consistency — Shaping Notes

## Scope

After the previous mock-sync-status-consistency fix, many resources had `syncStatus` changed from `synced` to `out-of-sync`/`provisioning`, but `targetStatus: 'Live'` was left as-is. A resource that's still being provisioned or not yet synced cannot be in a 'Live' state in the target environment.

## Rule

- `synced` → `targetStatus` Active (Live/Ready/Active/Online)
- `out-of-sync` or `provisioning` → `targetStatus` = `'Provisioning'`

## Decisions

- Applied uniformly across all projects regardless of project status.
- For M-11029 (`signed-off`), the non-synced resources still use `'Provisioning'` as targetStatus — they exist to be marked sync-completed, at which point they'd become 'Live'.

## Context

- **Visuals:** None
- **References:** Previous specs `2026-03-23-1200` and `2026-03-23-1215`
- **Product alignment:** N/A
