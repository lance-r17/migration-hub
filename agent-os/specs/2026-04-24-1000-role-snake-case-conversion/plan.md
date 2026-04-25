# Plan: Convert Role Values to snake_case

## Context

All user-facing role strings are currently stored as human-readable text ("Platform Migration Lead", "Technical Lead", "Business Owner"). This task converts them to snake_case identifiers to match the convention already used by "admin" and "member". Display labels are preserved via label maps in UI components — no visible change to the user.

## Conversion Map

| Old | New |
|---|---|
| "Platform Migration Lead" | "platform_migration_lead" |
| "Technical Lead" | "technical_lead" |
| "Business Owner" | "business_owner" |
| "admin" | unchanged |
| "member" | unchanged |

## Tasks

1. **Spec docs** — save this folder
2. **Backend: auth.py** — update `_ADMIN_ROLES` set
3. **Backend: migration 0008** — UPDATE users.role + approvals.role in DB
4. **Backend: seed data** — users.json, projects.json, email_templates.json
5. **Frontend: role comparisons** — 10 files, all `.includes()` / `===` / `Set` checks
6. **Frontend: SignOffModal** — fix `id` values and matching logic
7. **Frontend: role label display** — ApprovalTimeline, SignOffWorkflowBar, NavUser
8. **Frontend: email recipient roles** — emailTemplates.ts, ConfigTab.tsx
9. **Frontend: mock data** — mock.ts

## Deploy Note

`OAUTH_ROLE_MAPPINGS` env var must be updated: `"role": "Platform Migration Lead"` → `"role": "platform_migration_lead"`.
