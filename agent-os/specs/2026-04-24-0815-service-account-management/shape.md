# Service Account Management — Shaping Notes

## Scope

Build an admin-only UI for managing service accounts (machine-to-machine API users). Admins can create, update, delete (hard), and reset API tokens. The backend already supports create/list/revoke (soft); this work extends it with update, hard delete, and token reset.

## Decisions

- **Hard delete**: Service account records are fully removed from the DB on delete.
- **Strict role**: Only `"admin"` can access. `_ADMIN_ROLES` in `auth.py` is narrowed to `{"admin"}` and `require_admin` is reused for all admin endpoints (service accounts and Jira jobs).
- **Page placement**: `/admin/service-accounts` as a standalone admin page.
- **Token display**: Plaintext API key shown once in a modal after create or reset; backend never stores plaintext.
- **FK safety on delete**: Delete related `project_users` rows first (if any) before deleting the user, to avoid FK constraint errors.

## Context

- **Visuals:** None
- **References:** `backend/app/routers/admin.py`, `frontend/src/components/settings/EmbargoSection.tsx`, `frontend/src/hooks/use-embargos.ts`
- **Product alignment:** Supports governance/compliance by giving admins full control over machine-to-machine access.

## Standards Applied

- FastAPI router patterns (existing `admin.py`)
- React hooks/services pattern (`use-embargos.ts`, `embargos.ts`)
- shadcn/ui table/dialog patterns (`EmbargoSection.tsx`)
