# Plan: Extract Engagement into a Separate Table

## Context

Currently `engagement` is stored as a loose `JSONB` column on the `projects` table (added in migration `0023`). The user wants to refactor this into a dedicated relational table with a proper SQLAlchemy relationship to `Project`, improving data integrity and making it easier to query/index individual engagement fields in the future.

## Approach

Create a new `engagements` table with a **1:1 relationship** to `projects` (`project_id` is `UNIQUE`). Map scalar engagement fields to typed columns and keep nested structures (`plannedSlots`, `participantIds`, `notes`) in `JSONB` columns. Maintain **full API backward compatibility** so the frontend requires no changes.

### Engagement Model Design

| Column | Type | Source JSON key |
|--------|------|-----------------|
| `id` | String PK | generated |
| `project_id` | String FK → projects.id, UNIQUE | — |
| `status` | String, nullable | `status` |
| `interview_subject` | String, nullable | `interviewSubject` |
| `engagement_manager_id` | String, nullable | `engagementManagerId` |
| `confluence_page_url` | String, nullable | `confluencePageUrl` |
| `zoom_meeting_url` | String, nullable | `zoomMeetingUrl` |
| `zoom_meeting_id` | String, nullable | `zoomMeetingId` |
| `planned_slots` | JSONB, nullable | `plannedSlots` |
| `participant_ids` | JSONB, nullable | `participantIds` |
| `notes` | JSONB, nullable | `notes` |
| `created_at`, `updated_at` | TimestampMixin | — |

## Files to Modify

### Backend

1. **`backend/app/models/engagement.py`** — new model
2. **`backend/app/models/project.py`** — remove `engagement` JSONB column; add `engagement` relationship
3. **`backend/app/models/__init__.py`** — import new model
4. **`backend/app/schemas/project.py`** — keep schemas unchanged (API compatibility)
5. **`backend/app/services/project_service.py`** —
   - Remove `"engagement"` from `SECTION_COLUMN_MAP`
   - Remove `"engagement"` from `SECTION_LABELS` (or keep for audit logs, but handle specially)
   - Add `"engagement"` to `_FIELD_REL_REQUIREMENTS`
   - Add `selectinload(Project.engagement)` to `_project_options()` and default rel sets
   - Add `_replace_engagement()` handler in `update_section()`
   - Add `_engagement_to_dict()` helper
6. **`backend/app/routers/projects.py`** — serialize `p.engagement` → dict in `_project_list_item`, `_project_home_item`, `_project_detail`
7. **`backend/app/routers/zoom.py`** — read/write engagement model instead of dict
8. **`backend/alembic/versions/0024_extract_engagement_to_table.py`** — create table, migrate data, drop column

## Reuse

- Follow the `Risk` / `Approval` table patterns (`app/models/risk.py`, `app/models/approval.py`)
- Reuse `_diff_section()` and `audit_service.append_entry()` for change tracking in `_replace_engagement()`
- Reuse `_collect_attachment_ids()` to confirm attachments referenced inside engagement notes
- Reuse `selectinload(Project.engagement)` pattern from existing relationship loading

## Steps

- [ ] **1. Create `Engagement` model** (`backend/app/models/engagement.py`)
  - Inherit from `Base, TimestampMixin`
  - Define columns and `project` relationship with `back_populates="engagement"`
  - Add `to_dict(self) -> dict[str, Any]` method that returns camelCase JSON shape

- [ ] **2. Update `Project` model** (`backend/app/models/project.py`)
  - Remove `engagement: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)`
  - Add `engagement: Mapped["Engagement | None"] = relationship("Engagement", back_populates="project", uselist=False, cascade="all, delete-orphan")`

- [ ] **3. Update model exports** (`backend/app/models/__init__.py`)

- [ ] **4. Write Alembic migration** (`backend/alembic/versions/0024_extract_engagement_to_table.py`)
  - `op.create_table("engagements", ...)`
  - Data migration with `op.execute()` to extract JSONB fields into new rows:
    ```sql
    INSERT INTO engagements (id, project_id, status, interview_subject, ...)
    SELECT gen_random_uuid()::text, id,
           engagement->>'status',
           engagement->>'interviewSubject',
           ...
    FROM projects WHERE engagement IS NOT NULL;
    ```
  - `op.drop_column("projects", "engagement")`
  - **Downgrade**: re-add `projects.engagement` JSONB column and collapse relational data back with a simple SQL `UPDATE` that reassembles a JSONB object from the typed columns, then drop the `engagements` table.

- [ ] **5. Update `project_service.py`**
  - In `SECTION_COLUMN_MAP`, change `"engagement": "engagement"` → `"engagement": None`
  - In `update_section()`, add `elif section_key == "engagement": await _replace_engagement(...)`
  - Implement `_replace_engagement(session, project, value, actor)`:
    - Get or create `Engagement` for the project
    - Map camelCase keys to snake_case columns
    - Use `_diff_section(old_dict, new_dict)` for audit changes
    - Call `attachment_service.confirm_attachments()` for any `attachmentIds` in notes
  - Update `_project_options()` to include `selectinload(Project.engagement)`
  - Update `_resolve_rels` / default rels in `get_all` and `get_all_home` to load engagement
  - Add `_engagement_to_dict(e)` helper (or use model method)
  - **Preserve current reset behavior**: do NOT clear or delete the engagement record in `reset_project()`.

- [ ] **6. Update `routers/projects.py`**
  - In `_project_list_item`, `_project_home_item`, `_project_detail`: replace `engagement=p.engagement` with `engagement=_engagement_to_dict(p.engagement)`
  - In the partial-field builders (e.g. `if "engagement" in fields:`), also serialize

- [ ] **7. Update `routers/zoom.py`**
  - Replace dict-based access with model attribute access
  - Create engagement row if missing before scheduling

- [ ] **8. Verify zero frontend changes**
  - Confirm API response shape is identical
  - Confirm `PATCH /projects/{id}/sections/engagement` still accepts/returns the same JSON

## Verification

1. Run migration locally: `alembic upgrade head`
2. Check that existing projects with engagement data have rows in `engagements` table
3. Start backend and load a project with engagement — verify `GET /projects/{id}` returns identical JSON
4. Update engagement via UI calendar or notes — verify `PATCH /projects/{id}/sections/engagement` persists correctly
5. Schedule a Zoom meeting — verify `zoomMeetingId` and `zoomMeetingUrl` are saved
6. Check that projects without engagement return `engagement: null`
7. Run backend tests if available (none specific to engagement currently exist)

## Decisions

1. **Downgrade path**: Implement a simple downgrade that re-creates the `projects.engagement` JSONB column and collapses relational data back into it via SQL.
2. **Reset behavior**: Preserve current behavior — `reset_project()` does NOT clear or delete the engagement record.
3. **Indexing**: No index on `engagements.status` for now.
