# Standards for Admin Attachment Management

No formal `agent-os/standards/` directory exists in this project.

The following conventions were observed and followed:

- **Backend:** Python, FastAPI, SQLAlchemy 2.0, Pydantic v2, snake_case naming
- **Frontend:** Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons, camelCase naming
- **Database:** PostgreSQL, Alembic for migrations (no migration needed for this feature — only code changes)
- **Auth:** `require_admin` dependency for admin-only endpoints; `user?.role.includes('admin')` for frontend gating
