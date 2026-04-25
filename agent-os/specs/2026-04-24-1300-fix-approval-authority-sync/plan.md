# Plan: Fix Approval Authority Sync

## Context

`_sync_project_user_roles` only updates existing `project_users` rows — it never inserts. When a user is assigned as `businessOwnerId` but isn't already a project member, no `project_users` row is created for them, and `_check_approval_authority` returns 400. Compounding this, the OAuth login flow wipes all `project_users` rows (including governance roles) on every login.

## Tasks

### Task 1: Save spec documentation ✓
Created `agent-os/specs/2026-04-24-1300-fix-approval-authority-sync/`.

### Task 2: Fix `_sync_project_user_roles` ✓
**File:** `backend/app/services/project_service.py`

After updating existing rows, insert a `ProjectUser` for any governance-role holder not yet in the table. Verify user exists in DB before inserting.

### Task 3: Fix `sync_user_projects` ✓
**File:** `backend/app/services/user_service.py`

- Only delete `role='member'` rows for projects no longer in AD groups (leave governance roles untouched).
- When adding new projects, skip if an existing row already exists (preserving governance roles).

## Verification

1. Set `businessOwnerId='u-current'` for M-77122 → confirm `project_users` row created with `role='business_owner'` → PATCH approvals succeeds (200).
2. Log in via OAuth as u10 (Irene Cho, technicalLeadId for M-77122) → confirm `role='technical_lead'` survives login.
3. Regression: user removed from all AD groups loses `'member'` rows on next login; governance rows survive until `application_overview` changes.
