# Audit Log — Change History for Projects

## Context

Migration Hub projects are edited by multiple team members across 10 sections (approvals, risks, cloud resources, etc.). There is currently no way to trace who changed what and when. This is needed for compliance, coordination, and debugging — especially during the sensitive window before sign-off. The solution must be generic (works for any section), capture field-level diffs, and be accessible from each project's detail page via a timeline drawer.

---

## Architecture Overview

**Event types captured:**
- `section_updated` — any of the 10 project sections saved
- `status_changed` — project status transitions
- `approval_submitted` — sign-off approval per role
- `risk_created` / `risk_updated` / `risk_deleted` — risk lifecycle
- `resource_updated` — cloud resource edits
- `resource_sync_completed` — "mark sync complete" on a resource

**Interception strategy:** All mutations flow through `saveSection(key, value)` in `use-projects.ts`. The `previous` snapshot is already available there. We intercept at this single point with a `diffObjects` utility, then persist the audit entry to the mock store after a successful save.

**Data flow:**
```
component.handleSave()
  → saveSection(key, value)           ← intercept here
      → diffObjects(previous[key], value)
      → appendAuditEntry(projectId, entry)
      → updateProject(id, key, value)   ← existing path
```

---

## Files

| File | Action |
|------|--------|
| `frontend/src/types/audit.ts` | Create — AuditLogEntry types |
| `frontend/src/utils/diff.ts` | Create — Generic diffObjects utility |
| `frontend/src/services/auditLog.ts` | Create — Service layer (mock + API) |
| `frontend/src/hooks/use-audit-log.ts` | Create — Data fetching hook |
| `frontend/src/components/audit/AuditLogTimeline.tsx` | Create — Timeline display |
| `frontend/src/components/drawers/AuditLogDrawer.tsx` | Create — Drawer wrapper |
| `frontend/src/data/store.ts` | Modify — Add audit log map + methods |
| `frontend/src/data/mock.ts` | Modify — Add seeded mock audit entries |
| `frontend/src/hooks/use-projects.ts` | Modify — Intercept saveSection to emit audit entries |
| `frontend/src/pages/ProjectDetailsPage.tsx` | Modify — Add "Change History" button + drawer |

---

## Verification

1. Edit a section → open Change History → see field-level diff entry
2. Submit sign-off → approval entry appears with actor, role, timestamp
3. Add/edit/delete a risk → separate lifecycle entries
4. Mark a resource sync complete → `resource_sync_completed` entry
5. Change project status → `status_changed` entry with old → new
6. Seeded mock data → drawer pre-populated on page load
7. Filter chips → clicking "Approvals" shows only approval events
8. Empty state → new project shows "No changes recorded yet"
