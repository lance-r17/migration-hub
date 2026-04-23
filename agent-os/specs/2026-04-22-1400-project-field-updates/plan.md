# Plan: Project Field Updates

See `/home/node/.claude/plans/ultrathink-to-enhance-the-splendid-lynx.md` for the full implementation plan.

## Summary

Three field changes applied 2026-04-22:

1. "Data Residency" label renamed to "Data Residency Requirements" (key unchanged)
2. `eimId` / "EIM ID" renamed to `baId` / "BA ID" across all frontend + backend files
3. `replicationChanges` field removed from Target Architecture section

## Files Changed

### Task 2 — Data Residency label
- `frontend/src/hooks/use-projects.ts`
- `frontend/src/data/surveyFields.ts`
- `frontend/src/components/project/DataSecuritySection.tsx`
- `frontend/src/components/drawers/DataGovernanceDrawer.tsx`
- `backend/app/data/survey_field_defs.py`

### Task 3 — EIM ID → BA ID
- `frontend/src/types/index.ts`
- `frontend/src/hooks/use-projects.ts`
- `frontend/src/data/surveyFields.ts`
- `frontend/src/components/project/ApplicationOverviewSection.tsx`
- `frontend/src/components/project/DependenciesSection.tsx`
- `frontend/src/components/drawers/ProjectPreviewDrawer.tsx`
- `frontend/src/components/drawers/ApplicationProfileDrawer.tsx`
- `frontend/src/components/drawers/UpstreamDependenciesDrawer.tsx`
- `frontend/src/components/drawers/DownstreamDependenciesDrawer.tsx`
- `frontend/src/components/survey/SurveyModal.tsx`
- `backend/app/data/survey_field_defs.py`
- `backend/app/services/jira_service.py`
- `frontend/src/data/mock.ts`
- `backend/scripts/seed_data/projects.json`

### Task 4 — Remove Replication Changes
- `frontend/src/types/index.ts`
- `frontend/src/hooks/use-projects.ts`
- `frontend/src/data/surveyFields.ts`
- `frontend/src/components/project/TargetArchitectureSection.tsx`
- `frontend/src/components/drawers/TechnicalChangesDrawer.tsx`
- `backend/app/data/survey_field_defs.py`
- `frontend/src/data/mock.ts`
- `backend/scripts/seed_data/projects.json`
