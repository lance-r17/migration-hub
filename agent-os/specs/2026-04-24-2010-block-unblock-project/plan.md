# Plan: Block/Unblock Project with Platform Lead Authorization

## Overview

Add the ability for **Platform Migration Leads** to manually block and unblock projects from the project details page. When unblocking, the status is restored to its auto-derived value based on stage progress.

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-24-2010-block-unblock-project/` with plan.md, shape.md, standards.md, references.md, visuals/.

### Shape Notes

**Scope:**
- Backend: Restrict status changes to/from `blocked` to `platform_migration_lead` role only
- Backend: Return derived status when unblocking
- Frontend: Add Block/Unblock toggle button in ProjectDetailsPage metadata strip
- Frontend: Button visible only to `isPlatformLead`

**Decisions:**
- Block/Unblock action lives **only on Project Details Page** (not on project cards)
- Only `platform_migration_lead` role can block or unblock
- When unblocking, derive the correct status from `stageProgress` rather than defaulting to a hardcoded value
- Reuse existing `PATCH /projects/{id}/sections/{key}` endpoint — no new API endpoint needed

**Context:**
- Product: Migration Hub
- Status is now auto-derived from stage progress; `blocked` is the only manual override
- Existing `Sign-off` button in metadata strip shows the pattern for privileged actions

### References

| Reference | Location | Relevance |
|-----------|----------|-----------|
| `update_section` endpoint | `backend/app/routers/projects.py:150-168` | Section PATCH endpoint to add auth check to |
| `update_project` endpoint | `backend/app/routers/projects.py:138-153` | Direct PATCH endpoint (also needs auth check) |
| `ProjectDetailsPage` metadata strip | `frontend/src/pages/ProjectDetailsPage.tsx:373-433` | Where to add Block/Unblock button |
| `isPlatformLead` check | `frontend/src/pages/ProjectDetailsPage.tsx:293` | Existing role check pattern |
| `derive_status_from_stage_progress` | `backend/app/services/project_service.py:85-111` | Logic to use when unblocking |

---

## Task 2: Backend — Add Authorization for Blocked Status Changes

**Files:** `backend/app/routers/projects.py`

1. In `update_section()`, after retrieving `current_user`, check if `section_key == "status"` and the value is changing to/from `"blocked"`.
2. If so, verify `"platform_migration_lead" in (current_user.role or "")`.
3. If not authorized, raise `HTTPException(status_code=403, detail="Only Platform Migration Leads can block or unblock projects.")`.
4. If changing **away from** `blocked`, derive the correct status from `stageProgress` using `derive_status_from_stage_progress()` and use that derived value instead of the PATCHed value.
5. Apply the same auth check to `update_project()` for completeness (direct PATCH endpoint).

---

## Task 3: Frontend — Add Block/Unblock Button

**Files:** `frontend/src/pages/ProjectDetailsPage.tsx`

1. In the metadata strip, conditionally render:
   - If `project.status === 'blocked'` and `isPlatformLead`: **"Unblock Project"** button
     - On click: `handleSave('status', 'in-progress')` (backend will derive correct status)
   - If `project.status !== 'blocked'` and `isPlatformLead`: **"Block Project"** button
     - On click: `handleSave('status', 'blocked')`
2. Use a destructive/alert style for Block, and a neutral/emerald style for Unblock.
3. Show a confirmation toast on success, error toast on failure.

**Placement:** Place the Block/Unblock button in the metadata strip near the existing Sign-off CTA.

---

## Task 4: QA / Verification

1. Log in as a non-platform-lead user → verify Block/Unblock button is **not visible**.
2. Log in as platform lead → verify button is visible.
3. Block a project → verify status becomes `blocked`, badge updates, and backend rejects the same action from a non-lead (test via API directly).
4. Unblock a project → verify status restores to the correct derived value based on stage progress.
5. Verify the derived status after unblock matches what the stage progress stepper shows.
