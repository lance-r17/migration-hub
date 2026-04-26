# Admin Attachment Management — Shaping Notes

## Scope

Build an admin-only feature that lets administrators view all project attachments across all projects and permanently delete (housekeep) selected pending or soft-deleted files.

## Decisions

- **Global list view** (not per-project) — admin needs oversight across the entire platform
- **Bulk selection + hard delete** — admin selects rows via checkboxes and triggers permanent deletion
- **Status filtering** — All / Pending / Deleted / Confirmed tabs to focus housekeeping work
- **No audit logging** for bulk admin delete — out of scope, existing soft-delete already audits user actions
- **No pagination** — follows existing ServiceAccountsPage pattern; can add later if needed
- **Both backend + frontend** — FastAPI admin endpoints + React admin page with sidebar navigation

## Context

- **Visuals:** None provided
- **References:**
  - `backend/app/services/attachment_service.py` — existing `hard_delete_attachment`, `cleanup_orphaned_attachments`
  - `backend/app/routers/admin.py` — admin-only endpoint pattern with `require_admin`
  - `frontend/src/pages/ServiceAccountsPage.tsx` — admin page UI pattern (table, dialogs, restricted access)
- **Product alignment:** Supports Cloud Platform Team (admin) in overseeing migrations and keeping storage clean

## Standards Applied

N/A — No formal `agent-os/standards/` directory exists in this project. Conventions observed:
- Alembic migrations, SQLAlchemy 2.0, Pydantic v2, FastAPI
- React + TypeScript + Tailwind + shadcn/ui
- snake_case backend / camelCase frontend
