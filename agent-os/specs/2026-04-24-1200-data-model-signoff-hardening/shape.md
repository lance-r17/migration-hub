# Data Model & Sign-off Hardening — Shaping Notes

## Scope

Four targeted improvements to remove structural inconsistencies and close security gaps found during a deep-dive analysis on 2026-04-24:

1. Drop `projects.team` JSONB column; derive team display + membership from `project_users JOIN users`
2. Strictly enforce sign-off sequence (TL → BO → PML) in both frontend and backend
3. Add backend actor-auth check on approval submissions (prevents API-level forgery)
4. Enrich `project_users.role` with governance roles when ContactsOwnershipDrawer saves

## Decisions

- `team` display interface (`TeamMember[]`) is kept on the frontend Project type — only the data source changes, avoiding cascading type changes
- `isProjectMember` auto-fixes when team uses real user IDs; no code change needed
- Approval auth uses `project_users.role` (set by improvement #4) for TL/BO checks; `users.role` for PML
- Sequence validation raises `ValueError` → HTTP 400; no new exception type introduced
- `downgrade()` in migration restores the column as empty JSONB; no data restoration

## Context

- **Visuals:** None
- **References:** See references.md
- **Product alignment:** Enforces the governance model described in the product mission; directly fixes the "isProjectMember always false" silent bug that breaks survey access for all non-PML users

## Standards Applied

- N/A — no agent-os/standards/index.yml found in this repository
