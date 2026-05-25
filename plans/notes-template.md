# Notes Template Feature Plan

## Context
Introduce a **notes template** system that lets users save Notion-style block structures as reusable templates, then apply them when creating or editing engagement notes (and potentially other note types in the future).

### Current State
- Engagement notes are stored as JSONB (`notes`) on the `engagements` table.
- Frontend uses `NotionEditor` (`Block[]`) with `createBlock` / `cloneBlock` utilities.
- Backend has an existing template pattern: `email_templates` (CRUD router + SQLAlchemy model + Alembic migration).

## Design Decisions
| Question | Decision |
|----------|----------|
| **Categories** | Label-driven (`labels: string[]`). A template can have multiple labels. No fixed enum. |
| **Visibility** | Templates have a `scope` field: `global` (visible to everyone) or `private` (visible only to creator). Any authenticated user can create private templates. Only `platform_migration_lead` or `admin` can create / edit / delete `global` templates. |
| **Management UI** | Dedicated `/templates` page with card grid (list, preview, delete), linked from sidebar under `platform_migration_lead`. |
| **Project-specific data** | Strip `image.src`, `bookmark.url`, and any other project-specific identifiers before saving a template. Implement `sanitizeBlocksForTemplate()` in the frontend. |

## Approach

### Backend
1. **Model** (`backend/app/models/note_template.py`)
   - `id: str` PK
   - `name: str`
   - `description: str | None`
   - `labels: list[str]` (JSONB)
   - `blocks: list[dict]` (JSONB) — stores the `Block[]` array
   - `scope: str` (`global` | `private`)
   - `created_by: str | None` (user id)
   - `created_at`, `updated_at` timestamps
   - Reuse `Base` + `TimestampMixin` pattern from `email_template.py`.

2. **Router** (`backend/app/routers/note_templates.py`)
   - `GET /api/v1/note-templates` — list templates visible to current user (all `global` + own `private`). Accept `?label=` filter.
   - `GET /api/v1/note-templates/{id}` — get single template.
   - `POST /api/v1/note-templates` — create template. Enforce scope permissions.
   - `PUT /api/v1/note-templates/{id}` — update. Only creator (private) or platform lead/admin (global).
   - `DELETE /api/v1/note-templates/{id}` — delete with same auth rules.
   - Reuse `_template_out` helper pattern from `email_templates.py`.

3. **App registration** (`backend/app/main.py`)
   - Import and `app.include_router(note_templates.router, prefix=prefix)`.

4. **Migration** (`backend/alembic/versions/0025_add_note_templates.py`)
   - Create `note_templates` table with the columns above.
   - Follow the exact alembic pattern from `0024_extract_engagement_to_table.py`.

### Frontend
1. **Types** (`frontend/src/types/index.ts`)
   - Add `NoteTemplate` interface.

2. **Service** (`frontend/src/services/noteTemplates.ts`)
   - Mirror `emailService.ts` pattern: mock data fallback + `apiClient` wrappers.
   - `getNoteTemplates(label?)`, `getNoteTemplate(id)`, `createNoteTemplate(body)`, `updateNoteTemplate(id, body)`, `deleteNoteTemplate(id)`.

3. **Sanitize utility** (`frontend/src/lib/noteTemplateUtils.ts`)
   - `sanitizeBlocksForTemplate(blocks: Block[]): Block[]` — deep clone and strip `image.src`, `bookmark.url`, `image.caption` (optional), etc.
   - `cloneBlock` from `model.ts` can be reused for deep cloning.

4. **Template Picker Dialog** (`frontend/src/components/note-template/TemplatePicker.tsx`)
   - Reuse `Dialog`, `Select`, `Button` from `@/components/ui`.
   - Fetch templates via `getNoteTemplates('engagement')`.
   - Display template name + labels.
   - Allow user to choose **Replace** or **Append** when applying to existing notes.

5. **Save Template Dialog** (`frontend/src/components/note-template/SaveTemplateDialog.tsx`)
   - Inputs: name, description, labels (comma-separated or multi-select), scope (`global` / `private`).
   - On confirm, call `sanitizeBlocksForTemplate(currentBlocks)` then `createNoteTemplate(...)`.

6. **EngagementNotesEditPage** (`frontend/src/pages/EngagementNotesEditPage.tsx`)
   - **First-time creation**: if `blocks.length === 0` or only the default empty blocks, show a banner / inline picker to select a template.
   - **Existing notes**: Add a toolbar button "Apply Template…" that opens `TemplatePicker` (replace or append).
   - Add a toolbar button "Save as Template…" that opens `SaveTemplateDialog`.

7. **Template Management Page** (`frontend/src/pages/NoteTemplatesPage.tsx`)
   - Reuse `AppShell`, card grid layout from `EmailTemplatesPage.tsx`.
   - List all templates with label chips, scope badge, creator.
   - Click to preview blocks (read-only `NotionEditor`).
   - Delete action with confirmation.
   - Restrict sidebar nav item to `platform_migration_lead`.

8. **Routing & Navigation**
   - Add `/templates` route in `App.tsx`.
   - Add "Templates" nav item in `AppSidebar.tsx` (requires `platform_migration_lead`).

### Reuse Summary
| Existing code | Reused for |
|---------------|------------|
| `backend/app/models/email_template.py` | Model + TimestampMixin pattern |
| `backend/app/routers/email_templates.py` | CRUD router pattern, `_template_out` helper |
| `backend/alembic/versions/0024_*.py` | Migration structure |
| `frontend/src/services/emailService.ts` | Service module pattern with mock fallback |
| `frontend/src/pages/EmailTemplatesPage.tsx` | Card grid management UI layout |
| `frontend/src/components/ui/dialog.tsx` | Dialog primitive |
| `frontend/src/components/ui/select.tsx` | Select primitive |
| `frontend/src/components/notion-editor/model.ts` | `Block` types, `cloneBlock`, `createBlock` |
| `frontend/src/components/notion-editor/NotionEditor.tsx` | Read-only preview in management page |

## Files to Modify / Create
| Path | Action |
|------|--------|
| `backend/app/models/note_template.py` | **Create** — SQLAlchemy model |
| `backend/app/routers/note_templates.py` | **Create** — FastAPI CRUD router |
| `backend/app/main.py` | **Edit** — register router |
| `backend/alembic/versions/0025_add_note_templates.py` | **Create** — Alembic migration |
| `frontend/src/types/index.ts` | **Edit** — add `NoteTemplate` interface |
| `frontend/src/services/noteTemplates.ts` | **Create** — API service |
| `frontend/src/lib/noteTemplateUtils.ts` | **Create** — `sanitizeBlocksForTemplate` + helpers |
| `frontend/src/components/note-template/TemplatePicker.tsx` | **Create** — picker dialog |
| `frontend/src/components/note-template/SaveTemplateDialog.tsx` | **Create** — save-as-template dialog |
| `frontend/src/pages/EngagementNotesEditPage.tsx` | **Edit** — integrate picker + save dialog |
| `frontend/src/pages/NoteTemplatesPage.tsx` | **Create** — management page |
| `frontend/src/App.tsx` | **Edit** — add `/templates` route |
| `frontend/src/components/layout/AppSidebar.tsx` | **Edit** — add nav item |

## Steps
- [ ] **Step 1** — Backend model + migration (`note_template.py`, alembic migration).
- [ ] **Step 2** — Backend router (`note_templates.py`) with CRUD + auth checks.
- [ ] **Step 3** — Register router in `main.py`.
- [ ] **Step 4** — Frontend types + service (`noteTemplates.ts`).
- [ ] **Step 5** — Frontend sanitize utility (`noteTemplateUtils.ts`).
- [ ] **Step 6** — `TemplatePicker` component.
- [ ] **Step 7** — `SaveTemplateDialog` component.
- [ ] **Step 8** — Integrate picker & save dialog into `EngagementNotesEditPage`.
- [ ] **Step 9** — `NoteTemplatesPage` management UI.
- [ ] **Step 10** — Wire routing (`App.tsx`) and sidebar (`AppSidebar.tsx`).

## Verification
1. Run backend migration: `cd backend && alembic upgrade head`.
2. Start backend and test endpoints with curl or Swagger:
   - `POST /api/v1/note-templates` → create a template.
   - `GET /api/v1/note-templates` → list visible templates.
   - `DELETE /api/v1/note-templates/{id}` → delete.
3. Start frontend, navigate to **Templates** in sidebar:
   - Create a template from existing engagement notes.
   - Verify project-specific URLs are stripped in DB.
   - Preview template renders correctly in read-only `NotionEditor`.
4. Open an engagement with empty notes:
   - Select a template → notes populate with template blocks.
5. Open an engagement with existing notes:
   - Click **Apply Template** → choose replace or append → verify blocks update correctly.
6. Verify auth:
   - Non-lead user cannot see `/templates` nav item.
   - Non-lead user cannot create `global` templates (backend returns 403).
