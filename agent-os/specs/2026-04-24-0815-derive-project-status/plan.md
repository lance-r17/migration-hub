# Plan: Derive Project Status from Stage Progress + Enhanced Status Badge

## Overview

Enhance the project status presentation by:
1. **Deriving `project.status` from `stageProgress`** on the backend, so status is always consistent with actual project state
2. **Enhancing `StatusBadge`** on the frontend to show stage-aware contextual detail

The `blocked` status remains a manual override — once set, it stays until explicitly changed away.

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-24-0815-derive-project-status/` with:

- **plan.md** — This full plan
- **shape.md** — Shaping notes (scope, decisions, context)
- **standards.md** — N/A (no standards directory exists)
- **references.md** — Pointers to reference implementations studied
- **visuals/** — None provided

### Shape Notes

**Scope:**
- Backend: Compute `status` from `stageProgress` in `project_service.py`
- Backend: Wire derivation into `_recompute_and_store_progress()` and API response builders
- Frontend: Enhance `StatusBadge` component to show stage-aware tooltip/detail
- Frontend: Update `ProjectCard` and `ProjectDetailsPage` to pass `stageProgress` to `StatusBadge`

**Decisions:**
- `blocked` is sticky/manual-only. Auto-derivation skips projects whose current status is `blocked`.
- Status derivation rules:
  - `setup === 0` → `planning`
  - `setup === 100 && survey < 100` → `in-progress`
  - `setup === 100 && survey === 100 && signoff < 100` → `in-progress`
  - `setup === 100 && survey === 100 && signoff === 100 && migration === 0` → `signed-off`
  - `setup === 100 && survey === 100 && signoff === 100 && migration > 0 && migration < 100` → `migrating`
  - `setup === 100 && survey === 100 && signoff === 100 && migration === 100` → `completed`
- Keep existing `ProjectStatus` type values — no new status enums needed.
- Frontend `StatusBadge` accepts an optional `stageProgress` prop to compute contextual detail text.

**Context:**
- Product: Migration Hub — internal cloud migration coordination tool
- `stageProgress` already computed by backend; currently only used in tooltip (ProjectCard) and stepper (ProjectDetailsPage)
- `status` is currently stored and manually updated, leading to potential drift from actual progress

### References

| Reference | Location | Relevance |
|-----------|----------|-----------|
| `compute_stage_progress` | `backend/app/services/project_service.py:61-83` | Existing stage computation logic to extend |
| `_recompute_and_store_progress` | `backend/app/services/project_service.py:85-88` | Hook point for status derivation |
| `_project_list_item` / `_project_detail` | `backend/app/routers/projects.py:41-98` | API response builders that should return derived status |
| `StatusBadge` | `frontend/src/components/shared/StatusBadge.tsx` | Component to enhance |
| `ProjectCard` | `frontend/src/components/home/ProjectCard.tsx` | Surface to update |
| `ProjectDetailsPage` | `frontend/src/pages/ProjectDetailsPage.tsx` | Surface to update |
| Mock data | `frontend/src/data/mock.ts` | May need status corrections for consistency |

---

## Task 2: Backend — Implement Status Derivation

**Files:** `backend/app/services/project_service.py`

1. Add `derive_status_from_stage_progress(stage_data: dict) -> str` function that maps stage percentages to status string using the rules above.
2. Add `_is_blocked(project)` helper or inline check: if `project.status == "blocked"`, return `"blocked"`.
3. Update `_recompute_and_store_progress()` to also derive and set `project.status` (unless currently `blocked`).
4. Update `_project_list_item()` and `_project_detail()` in `backend/app/routers/projects.py` to derive status on-the-fly (respecting `blocked` override) instead of passing raw `p.status`.

**Edge cases:**
- If `project.status == "blocked"`, preserve it.
- If user manually PATCHes status away from `blocked"`, next recompute will derive the correct status.

---

## Task 3: Frontend — Enhance StatusBadge

**Files:** `frontend/src/components/shared/StatusBadge.tsx`

1. Add optional `stageProgress?: StageProgress` prop.
2. Add `getStatusDetail(status, stageProgress)` helper that returns contextual detail text:
   - `planning` → "Awaiting setup"
   - `in-progress` + setup=100, survey=0 → "Awaiting survey"
   - `in-progress` + survey=100, signoff<100 → "Awaiting sign-off"
   - `signed-off` → "Ready for migration"
   - `migrating` → "In progress"
   - `completed` → "All done"
   - `blocked` → "Needs attention"
3. Render detail as a tooltip on hover (using existing `Tooltip` primitive) or as small sub-text if space permits.
4. Keep the base badge label unchanged to avoid breaking existing layout.

---

## Task 4: Frontend — Update Project Surfaces

**Files:**
- `frontend/src/components/home/ProjectCard.tsx`
- `frontend/src/pages/ProjectDetailsPage.tsx`

1. In `ProjectCard`, pass `stageProgress={project.stageProgress}` to `<StatusBadge />`.
2. In `ProjectDetailsPage` header, pass `stageProgress={project.stageProgress}` to `<StatusBadge />`.
3. Verify no layout regressions — badge should remain compact.

---

## Task 5: Mock Data Consistency (if needed)

**Files:** `frontend/src/data/mock.ts`

1. Review mock project statuses against what derivation would produce.
2. Adjust any obviously inconsistent mock statuses so the enhanced badge looks correct in dev/mock mode.
3. Note: mock data lacks `stageProgress` and `surveySubmittedAt` on some projects — consider adding `surveySubmittedAt` where appropriate so stage computation is realistic.

---

## Task 6: QA / Verification

1. Start backend and frontend.
2. Verify that changing project data (adding resources, submitting survey, approving sign-offs, marking migrations complete) auto-updates status correctly.
3. Verify that manually setting `blocked` persists across recomputes.
4. Verify that `StatusBadge` tooltip/detail appears on both project card and details page.
5. Run existing e2e tests (`frontend/e2e/tests/home.spec.ts`) to ensure no regressions.

---

## Rollback / Safety

- If derivation causes issues, the stored `status` column can still be PATCHed directly.
- The derivation logic is centralized in `project_service.py` — easy to adjust rules.
- Frontend changes are additive (new optional prop) — no breaking changes.
