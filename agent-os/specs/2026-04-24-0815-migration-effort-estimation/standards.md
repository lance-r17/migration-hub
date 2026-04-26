# Standards for Migration Effort Estimation

No formal `agent-os/standards/` files exist in this project. The following conventions were observed and followed:

1. **Backend patterns**
   - Alembic migrations for schema changes
   - SQLAlchemy 2.0 declarative mapping with `Mapped` and `mapped_column`
   - Pydantic v2 schemas with `ConfigDict(from_attributes=True)`
   - FastAPI routers with `APIRouter`
   - JSONB sections updated via `PATCH /projects/{id}/sections/{section_key}`

2. **Frontend patterns**
   - React + TypeScript with Tailwind CSS
   - shadcn/ui components
   - `useProject` hook with `saveSection` for optimistic updates
   - Survey field definitions in `frontend/src/data/surveyFields.ts` must exactly match `backend/app/data/survey_field_defs.py`
   - API mappers in `services/projects.ts` translate snake_case backend to camelCase frontend

3. **File upload pattern**
   - FastAPI `UploadFile` with multipart form data
   - Files stored on local filesystem under `uploads/`
   - Metadata tracked in relational table (`project_attachments`)
