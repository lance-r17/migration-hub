# Survey Resource Updated Events — Shaping Notes

## Scope

Change survey spec updates from one bundled `survey_submitted` audit entry to per-resource `resource_updated` entries, consistent with how other entity-level changes (risks) are tracked.

## Decisions

- Event type: `resource_updated` (not `survey_submitted`)
- One entry per resource that actually changed specs
- `entityLabel` carries resource name — no name prefix needed in change labels
- Backend and frontend mock both updated

## Context

- **Visuals:** None
- **References:** Risk events pattern in `use-projects.ts` (per-entity events); `resource_updated` config in `AuditLogTimeline.tsx`
