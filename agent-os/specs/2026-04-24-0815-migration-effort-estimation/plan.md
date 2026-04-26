# Plan: Migration Effort Estimation Section

## Overview

Add a new **"Migration Effort Estimation"** section to project details. The section contains:
1. **Migration estimate (Effort Cost)** — numeric value in thousands (K), currency aligned with billing setup (default CNY from `BillingThresholdConfig`). Description: "Provide your best current estimate for this project's migration effort and cost. If unknown, enter \"TBC\" and explain in Notes."
2. **Notes (breakdown & rationale)** — free text with server-side file upload for attachments (e.g. vendor quotes). Description: "Prioritise a clear breakdown and rationale: scope, key assumptions, exclusions, risks and any vendor quotes."

The feature must be reflected in:
- **Project details** (view/edit section on ProjectDetailsPage)
- **Survey** (configurable survey questions that write to the section)
- **Wave plan gantt chart** (effort estimate visible in the project row)

User explicitly chose: server file upload for attachments, add to survey field definitions, and gantt-only (no email template merge fields).

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-24-0815-migration-effort-estimation/` with:

- **plan.md** — This full plan
- **shape.md** — Shaping notes (scope, decisions, context from conversation)
- **standards.md** — Relevant standards that apply to this work
- **references.md** — Pointers to reference implementations studied
- **visuals/** — Empty (no mockups provided)

---

## Task 2: Backend — Database & Model

**Goal:** Add `migration_effort_estimation` JSONB column to `projects` and wire it through schemas/routers.

**Files to modify:**

1. **Alembic migration** (`backend/alembic/versions/0016_add_migration_effort_estimation.py`)
   - Add `migration_effort_estimation` column to `projects` table (JSONB, nullable=True)

2. **`backend/app/models/project.py`**
   - Add: `migration_effort_estimation: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)`

3. **`backend/app/schemas/project.py`**
   - Add `migration_effort_estimation: dict[str, Any] | None = None` to:
     - `ProjectListItem`
     - `ProjectDetail`
   - Add `migration_effort_estimation: dict[str, Any] | None = None` to `ProjectPatch`

4. **`backend/app/routers/projects.py`**
   - In `_project_list_item()`: add `migration_effort_estimation=p.migration_effort_estimation`
   - In `_project_detail()`: add `migration_effort_estimation=p.migration_effort_estimation`

5. **`backend/app/services/project_service.py`**
   - Add `"migrationEffortEstimation": "migration_effort_estimation"` to `SECTION_COLUMN_MAP`
   - Add `"migrationEffortEstimation": "Migration Effort Estimation"` to `SECTION_LABELS`
   - Note: `update_section` already handles generic JSONB sections via `_diff_section` and audit logging — no extra service logic needed.

6. **`backend/app/data/survey_field_defs.py`**
   - Add two field definitions at the end:
     ```python
     {"id": "effort__estimate",      "sectionKey": "migrationEffortEstimation", "fieldPath": "effortEstimate", "label": "Migration Effort Estimate", "sectionLabel": "Migration Effort Estimation", "inputType": "short_text", "defaultQuestion": "What is the estimated migration effort and cost (in thousands)?", "defaultHint": "Enter a numeric value in thousands (K). If unknown, enter TBC and explain in Notes."},
     {"id": "effort__notes",         "sectionKey": "migrationEffortEstimation", "fieldPath": "notes",          "label": "Notes (Breakdown & Rationale)", "sectionLabel": "Migration Effort Estimation", "inputType": "long_text",  "defaultQuestion": "Provide a breakdown and rationale for the effort estimate.", "defaultHint": "Include scope, key assumptions, exclusions, risks and any vendor quotes."},
     ```

---

## Task 3: Backend — Project Attachment Upload System

**Goal:** Build a lightweight file upload system for project attachments, used by the Notes field.

**New files:**

1. **`backend/app/models/project_attachment.py`**
   ```python
   class ProjectAttachment(Base):
       __tablename__ = "project_attachments"
       id: Mapped[str] = mapped_column(String, primary_key=True)
       project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
       filename: Mapped[str] = mapped_column(String, nullable=False)
       file_path: Mapped[str] = mapped_column(String, nullable=False)
       created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
   ```

2. **`backend/app/schemas/project_attachment.py`**
   ```python
   class AttachmentOut(BaseModel):
       model_config = ConfigDict(from_attributes=True)
       id: str
       project_id: str
       filename: str
       file_path: str
       created_at: str | None = None
   ```

3. **`backend/alembic/versions/0017_add_project_attachments.py`**
   - Create `project_attachments` table

4. **Upload directory:** `backend/uploads/projects/{project_id}/`

**Files to modify:**

5. **`backend/app/routers/projects.py`** — Add endpoints under the existing `projects` router:
   - `POST /projects/{project_id}/attachments` — `UploadFile`, saves to `uploads/projects/{project_id}/{uuid}_{filename}`, creates `ProjectAttachment` row, returns `AttachmentOut`
   - `GET /projects/{project_id}/attachments` — list attachments for project
   - `GET /projects/{project_id}/attachments/{attachment_id}` — stream/download file
   - `DELETE /projects/{project_id}/attachments/{attachment_id}` — delete file + DB row

6. **`backend/app/main.py`** — Ensure `uploads/` directory exists at startup (or let the endpoint create it).

---

## Task 4: Frontend — Types, Services & Hooks

**Goal:** Wire the new section through the frontend type system and API layer.

**Files to modify:**

1. **`frontend/src/types/index.ts`**
   - Add interface:
     ```typescript
     export interface MigrationEffortEstimation {
       effortEstimate?: string
       notes?: string
       attachmentIds?: string[]
     }
     ```
   - Add `migrationEffortEstimation?: MigrationEffortEstimation` to `Project` interface

2. **`frontend/src/services/projects.ts`**
   - Add `migration_effort_estimation: MigrationEffortEstimation | null` to `ProjectApiResponse`
   - Map it in `fromApi()`: `migrationEffortEstimation: raw.migration_effort_estimation ?? undefined`

3. **`frontend/src/hooks/use-projects.ts`**
   - Add `migrationEffortEstimation: 'Migration Effort Estimation'` to `SECTION_LABELS`
   - Add `migrationEffortEstimation` field label map:
     ```typescript
     migrationEffortEstimation: {
       effortEstimate: 'Effort Estimate',
       notes: 'Notes',
       attachmentIds: 'Attachments',
     }
     ```

4. **`frontend/src/services/attachments.ts`** (new file)
   - `uploadAttachment(projectId, file)` — multipart POST
   - `getAttachments(projectId)` — GET list
   - `deleteAttachment(projectId, attachmentId)` — DELETE

---

## Task 5: Frontend — MigrationEffortEstimationSection Component

**Goal:** Create the section UI for viewing and editing effort estimate, notes, and attachments.

**New file:**

1. **`frontend/src/components/project/MigrationEffortEstimationSection.tsx`**
   - Props: `data?: MigrationEffortEstimation`, `projectId: string`, `onSave?: (d: MigrationEffortEstimation) => void`
   - View mode: show effort estimate with currency (read from billing config), notes text, and attachment list with download links
   - Edit mode (drawer or inline — follow existing section pattern):
     - Effort estimate input: text/number field, suffix "K" + currency (fetched via `getBillingThresholdConfig`)
     - Notes: textarea
     - Attachments: file input for upload, list uploaded files with delete button
   - When saving, call `onSave` with updated object including `attachmentIds`
   - Follow the visual pattern of other sections (card with header, view vs edit states)

**Reference patterns:**
- `ApplicationOverviewSection.tsx` for card + drawer pattern
- `TargetArchitectureSection.tsx` for simpler section layout

---

## Task 6: Frontend — Integrate into ProjectDetailsPage

**Goal:** Add the new section to the project details page.

**File to modify:**

1. **`frontend/src/pages/ProjectDetailsPage.tsx`**
   - Import `MigrationEffortEstimationSection`
   - Add component in the sections area:
     ```tsx
     <MigrationEffortEstimationSection
       data={project.migrationEffortEstimation}
       projectId={project.id}
       onSave={!isLocked ? (d) => handleSave('migrationEffortEstimation', d) : undefined}
     />
     ```

---

## Task 7: Frontend — Survey Field Definitions

**Goal:** Add the two survey fields so they appear in the survey builder and modal.

**Files to modify:**

1. **`frontend/src/data/surveyFields.ts`**
   - Append two `SurveyFieldDef` entries (matching backend `survey_field_defs.py`):
     ```typescript
     {
       id: 'effort__estimate',
       sectionKey: 'migrationEffortEstimation',
       fieldPath: 'effortEstimate',
       label: 'Migration Effort Estimate',
       sectionLabel: 'Migration Effort Estimation',
       inputType: 'short_text',
       defaultQuestion: 'What is the estimated migration effort and cost (in thousands)?',
       defaultHint: 'Enter a numeric value in thousands (K). If unknown, enter TBC and explain in Notes.',
     },
     {
       id: 'effort__notes',
       sectionKey: 'migrationEffortEstimation',
       fieldPath: 'notes',
       label: 'Notes (Breakdown & Rationale)',
       sectionLabel: 'Migration Effort Estimation',
       inputType: 'long_text',
       defaultQuestion: 'Provide a breakdown and rationale for the effort estimate.',
       defaultHint: 'Include scope, key assumptions, exclusions, risks and any vendor quotes.',
     }
     ```

2. **`frontend/src/types/survey.ts`** — No changes needed; existing `SurveyInputType` covers `short_text` and `long_text`.

---

## Task 8: Frontend — Wave Gantt Chart Integration

**Goal:** Display the effort estimate in the wave gantt chart left panel.

**File to modify:**

1. **`frontend/src/components/waves/WaveGanttChart.tsx`**
   - Add an **Effort** column to the left panel project row.
   - Change `LEFT_PANEL_W` from `600` to `680`
   - Change `LP_GRID` from `'40px minmax(160px,1fr) 100px 80px 32px'` to `'40px minmax(160px,1fr) 100px 80px 80px 32px'`
   - Update all places that render the left panel grid (project rows, task rows, header, ghosts) to include the new column:
     - Header row: add "Effort" column header
     - Project row: render `p.migrationEffortEstimation?.effortEstimate` with "K" suffix (or "—" if empty)
     - Task row: leave empty cell for the effort column
     - Ghost rows: add empty cell for the new column
   - Keep the column narrow (80px) to show e.g. "150K" or "TBC"

---

## Task 9: Testing & Verification

**Backend:**
- Run `alembic upgrade head` to apply migrations
- Start backend and verify:
  - `GET /api/v1/projects/{id}` returns `migration_effort_estimation`
  - `PATCH /api/v1/projects/{id}/sections/migrationEffortEstimation` updates the section
  - `POST /api/v1/projects/{id}/attachments` uploads files
  - `GET /api/v1/settings/survey/field-defs` returns the new effort fields

**Frontend:**
- Run `npm run build` in `frontend/` to verify TypeScript compiles
- Verify:
  - Project details page shows "Migration Effort Estimation" section
  - Section can be edited, saved, and reloaded
  - File upload works within the section
  - Survey builder shows the new fields under "Migration Effort Estimation"
  - Survey modal can fill and save these fields
  - Wave gantt chart shows effort estimate in the new left panel column
