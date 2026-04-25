# Fix: Approval Authority Sync — Shaping Notes

## Scope

Bug fix: approval rejected with 400 even when the logged-in user is the project's business owner.

Two related defects in the sign-off flow:
1. `_sync_project_user_roles` only updates existing `project_users` rows — never inserts for governance-role holders who aren't already project members.
2. `sync_user_projects` (called on OAuth login) deletes ALL `project_users` rows and re-inserts as `'member'`, wiping governance roles.

## Decisions

- Fix both defects in the same PR — they compound each other and fixing only one leaves a latent failure path.
- No schema migration needed — purely logic fixes in two service functions.
- Governance roles (business_owner, technical_lead, dba_data_owner) are authoritative from `application_overview`; AD-group sync only manages `'member'` rows.
- Do not delete governance-role rows during AD-group sync — they're owned by `_sync_project_user_roles`, not by OAuth login.

## Context

- **Visuals:** None
- **References:** `backend/app/services/project_service.py` (`_sync_project_user_roles`, `_check_approval_authority`), `backend/app/services/user_service.py` (`sync_user_projects`), `backend/app/routers/oauth.py` (OAuth login flow)
- **Product alignment:** N/A

## Standards Applied

- api/error-handling — 400 must only be returned for genuine client errors, not backend sync bugs
