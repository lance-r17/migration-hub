# Plan: Add Software Origin Field & Link to Effort Table Third-Party Default

**Feature slug:** `software-origin-field`  
**Folder:** `agent-os/specs/2026-04-26-1048-software-origin-field/`

## Goal

Add a "Software origin" field to the Application Overview section with two options: `in-house` / `3rd party`. Update survey definitions, email template variables, and Jira story generation. When the value is `3rd party`, new effort-breakdown tasks default their "Third party?" flag to `true`; otherwise they default to `false`. Users can still override individual tasks.

## Approach

Single recommended approach — the scope is narrow and the codebase already has clear patterns for adding fields to JSONB sections.

### Summary of changes

| Area | Files | Change |
|------|-------|--------|
| **Types** | `frontend/src/types/index.ts` | Add `softwareOrigin?: 'in-house' \| '3rd party'` to `ApplicationOverview` |
| **Display** | `frontend/src/components/project/ApplicationOverviewSection.tsx` | Render badge for `softwareOrigin` |
| **Edit drawer** | `frontend/src/components/drawers/ApplicationProfileDrawer.tsx` | Add select control for `softwareOrigin` |
| **Survey defs (FE)** | `frontend/src/data/surveyFields.ts` | Add `appoverview__softwareOrigin` field def |
| **Survey defs (BE)** | `backend/app/data/survey_field_defs.py` | Add matching Python field def |
| **Effort table editor** | `frontend/src/components/project/EffortTableEditor.tsx` | Accept `softwareOrigin` prop; default `thirdParty` on new empty tables |
| **Effort estimation section** | `frontend/src/components/project/MigrationEffortEstimationSection.tsx` | Pass `softwareOrigin` prop |
| **Survey effort input** | `frontend/src/components/survey/EffortTableSurveyInput.tsx` | Accept & pass `softwareOrigin` prop |
| **Survey modal** | `frontend/src/components/survey/SurveyModal.tsx` | Pass `project.applicationOverview?.softwareOrigin` to effort input |
| **Project details page** | `frontend/src/pages/ProjectDetailsPage.tsx` | Pass `softwareOrigin` to `MigrationEffortEstimationSection` |
| **Email variables** | `frontend/src/types/email.ts` | Add `project.softwareOrigin` to `TEMPLATE_VARIABLES` |
| **Email preview** | `frontend/src/pages/EmailPreviewPage.tsx` | Add sample data for `project.softwareOrigin` |
| **Jira story** | `backend/app/services/jira_service.py` | Include Software Origin in the Migration Overview ADF table |
| **Mock data** | `frontend/src/data/mock.ts` | Add `softwareOrigin` to mock `applicationOverview` objects |

## Tasks

### Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-26-1048-software-origin-field/` with:

- `plan.md` — This plan
- `shape.md` — Shaping notes (scope, decisions, context)
- `standards.md` — N/A (no `agent-os/standards/` exists)
- `references.md` — Pointers to similar code patterns studied
- `visuals/` — Empty (no mockups provided)

### Task 2: Update Frontend Types & Application Overview UI

1. Add `softwareOrigin?: 'in-house' | '3rd party'` to `ApplicationOverview` interface in `frontend/src/types/index.ts`.
2. Render the field in `ApplicationOverviewSection.tsx` (similar to `ibsInScope` badge pattern).
3. Add the select input in `ApplicationProfileDrawer.tsx` (similar to `migrationStrategy` select), positioned between **IBS In Scope** and **Migration Strategy**. Persist value as `"in-house" | "3rd party" | undefined`.

### Task 3: Update Survey Field Definitions

1. Add `appoverview__softwareOrigin` to `frontend/src/data/surveyFields.ts` (`inputType: 'select'`, options `['in-house', '3rd party']`).
2. Add matching entry to `backend/app/data/survey_field_defs.py`.

### Task 4: Wire Software Origin into Effort Table Defaults

1. Update `EffortTableEditor.tsx`:
   - Add optional `softwareOrigin?: string` prop.
   - Modify `createEmptyTable()` to accept `softwareOrigin` and set `thirdParty` on each predefined task:
     - `'3rd party'` → `true`
     - otherwise → `false`
   - Update `normalizedTables` memo and `handleModeChange` to pass the prop through.
2. Update `MigrationEffortEstimationSection.tsx` to receive and pass `softwareOrigin` prop.
3. Update `EffortTableSurveyInput.tsx` to accept and pass `softwareOrigin` prop.
4. Update `SurveyModal.tsx` (line ~351) to pass `project.applicationOverview?.softwareOrigin` into `EffortTableSurveyInput`.
5. Update `ProjectDetailsPage.tsx` to pass `softwareOrigin={project.applicationOverview?.softwareOrigin}` to `MigrationEffortEstimationSection`.

> **Note:** The default only applies to *new* empty tables (first-time creation or mode-switch). Existing tables with explicit `thirdParty` values are **not** overwritten when the user changes Software Origin later, preserving the "user can still adjust them" requirement.

### Task 5: Update Email & Jira References

1. Add `{ key: 'project.softwareOrigin', label: 'Software Origin', category: 'Project', example: 'in-house' }` to `TEMPLATE_VARIABLES` in `frontend/src/types/email.ts`.
2. Add `project.softwareOrigin` sample data to all three `SAMPLE_DATA_SETS` in `frontend/src/pages/EmailPreviewPage.tsx`.
3. In `backend/app/services/jira_service.py`, add `("Software Origin", ao.get("softwareOrigin"))` to the Migration Overview ADF key-value table.

### Task 6: Update Mock Data

Add `softwareOrigin: 'in-house'` (or `'3rd party'` for variety) to all `applicationOverview` objects in `frontend/src/data/mock.ts`.

### Task 7: Verification

1. Run frontend type-check (`npm run build` or `tsc --noEmit` in `frontend/`).
2. Run backend tests if available (`pytest` in `backend/`).
3. Manually verify:
   - Application Overview shows Software Origin badge.
   - Edit drawer allows changing the value.
   - Survey includes the new question.
   - Creating effort estimation with `3rd party` pre-checks "Yes" on all tasks.
   - Creating effort estimation with `in-house` pre-checks "No" on all tasks.
   - Individual task toggles remain editable.
