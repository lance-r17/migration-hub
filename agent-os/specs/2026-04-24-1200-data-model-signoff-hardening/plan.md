# Data Model & Sign-off Hardening — Plan

## Problem

Three structural gaps found during deep-dive analysis (2026-04-24):

1. `projects.team` JSONB stores synthetic IDs (t1, t2) that never match real user IDs → `isProjectMember` always false in backend mode → survey access and resource editing silently broken
2. Sign-off sequence (TL → BO → PML) is advisory only — both `canSignOff` and `_replace_approvals()` lack predecessor/auth checks
3. Any authenticated user can forge any approval via direct API call — zero backend validation

## Tasks

### Task 1: Spec documentation ✓
Saved to `agent-os/specs/2026-04-24-1200-data-model-signoff-hardening/`

### Task 2: Migration 0009
Drop `projects.team` column.
File: `backend/alembic/versions/0009_drop_team_column.py`

### Task 3: Backend — derive team from project_users
- Remove `team` mapped column from `Project` model
- Remove `"team"` from `SECTION_COLUMN_MAP` / `SECTION_LABELS`
- Remove `team` from `ProjectPatch`
- Add `selectinload(Project.project_users).selectinload(ProjectUser.user)` to `_project_options()`
- Build `team` response field from `p.project_users` in router helpers

### Task 4: Backend — enrich project_users.role
- Add `GOVERNANCE_ROLE_FIELDS` constant
- Add `_sync_project_user_roles()` helper
- Call it from `update_section()` when `section_key == "applicationOverview"`

### Task 5: Backend — approval sequence + actor auth
- Add `APPROVAL_SEQUENCE` constant
- Add `_validate_approval_sequence()` — raises ValueError on out-of-order approval
- Add `_check_approval_authority()` — checks actor's project_users.role or users.role
- Wire both into `_replace_approvals()`

### Task 6: Frontend — sequential sign-off
- `ProjectDetailsPage.tsx`: add `APPROVAL_SEQUENCE`, fix `canSignOff` with predecessor check
- Fix `applyApproval` to advance next role to `waiting` on success

### Task 7: Seed data cleanup
- Remove `"team": [...]` arrays from all projects in `seed_data/projects.json`
- Verify `project_users` lists cover all `application_overview.*Id` references
