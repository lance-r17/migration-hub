# Audit Log — Change History — Shaping Notes

## Scope

Generic audit log that captures every mutation to a project with field-level diffs. Accessible from each project detail page via a "Change History" side drawer with a grouped timeline.

## Decisions

- **Single interception point**: All mutations flow through `saveSection(key, value)` in `use-projects.ts` which already holds a `previous` snapshot — ideal place to diff and record entries.
- **Field-level diffs**: Show old → new for each changed field, not just "section X was updated". Uses a generic `diffObjects` utility with per-section label maps.
- **Side drawer**: Consistent with the 24 existing edit drawers (shadcn Sheet). Button placed in the project page header after the status badge.
- **Mock + real API dual path**: Follows the existing `USE_MOCK` flag pattern in all other services.
- **Per-project audit log in store**: `_auditLogs: Record<projectId, AuditLogEntry[]>` — simple and consistent with how `_projects` is managed.
- **Event classification by section key**: `approvals` → `approval_submitted`, `risks` → `risk_created/updated/deleted`, `status` → `status_changed`, `currentInfrastructure` → `resource_updated/resource_sync_completed`, everything else → `section_updated`.

## Event Types Captured

1. `section_updated` — any of the 10 register sections
2. `status_changed` — project status transitions
3. `approval_submitted` — sign-off approvals per role
4. `risk_created` / `risk_updated` / `risk_deleted` — risk lifecycle
5. `resource_updated` — cloud resource edits (including needMigration toggles)
6. `resource_sync_completed` — syncStatus changed to 'synced'

## Context

- **Visuals:** None provided — consistent with existing drawer UI pattern
- **References:** `ActivityTimeline.tsx` (dashboard), `ApprovalTimeline.tsx` (sign-off modal), existing drawer components
- **Product alignment:** Supports compliance and coordination requirements; aligns with "structured sign-off workflow" in mission.md

## Standards Applied

- Follow existing mock/real API dual-path pattern (USE_MOCK flag)
- Follow existing shadcn Sheet pattern for drawers
- Follow existing hook pattern (useState + useEffect + useCallback)
- Lucide icons throughout; Tailwind CSS with design system color tokens
