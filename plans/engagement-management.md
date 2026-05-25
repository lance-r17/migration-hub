# Engagement Management Feature Plan

## Context
Introduce a new "engagement management" capability to help Platform Migration Leads schedule and track migration interviews with project teams. Each project gets an `engagement` JSONB section, and a new calendar page provides a month-view for scheduling and managing those engagements.

## Data Model

### `Engagement` (stored as JSONB on `projects`)
```typescript
interface EngagementSlot {
  id: string           // stable ID for each slot
  start: string        // ISO datetime
  end: string          // ISO datetime
}

interface Engagement {
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  interviewSubject?: string
  plannedSlots: EngagementSlot[]      // multiple candidate slots
  actualSlot?: EngagementSlot         // final chosen slot
  participantIds: string[]            // from platform_migration_lead users + project team
  engagementManagerId?: string        // from platform_migration_lead users
  notes?: string                      // HTML string from TipTap
  confluencePageUrl?: string          // link to exported Confluence page (populated later)
  zoomMeetingUrl?: string             // link to scheduled Zoom meeting
  zoomMeetingId?: string              // Zoom meeting ID
}
```

## ASCII Prototype

### Calendar Month View (`/engagements`)
```
+------------------------------------------------------------------+
|  ←  Engagement Calendar  →   [Month dropdown] [Year dropdown]     |
|                                                                  |
|  Sun      Mon      Tue      Wed      Thu      Fri      Sat       |
|  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐       |
|  │ 1  │  │ 2  │  │ 3  │  │ 4  │  │ 5  │  │ 6  │  │ 7  │       |
|  │    │  │ ██ │  │ ██ │  │    │  │ ██ │  │    │  │    │       |
|  │    │  │Proj│  │Proj│  │    │  │Proj│  │    │  │    │       |
|  │    │  │ A  │  │ B  │  │    │  │ C  │  │    │  │    │       |
|  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘       |
|  ...                                                             |
|                                                                  |
|  Legend: █ scheduled  ░ planned (pending)  ▓ completed           |
+------------------------------------------------------------------+
```
- Each day cell shows up to 2-3 project pills (colored by status).
- Click a day cell → open drawer to add/edit engagements for that date.
- Click an existing project pill → open drawer focused on that project.

### Engagement Edit Drawer (right-side sheet)
```
+--------------------------------------------------------+
|  ✕  Edit Engagement — Project Alpha                    |
|                                                        |
|  Status          [Scheduled ▼]                         |
|  Interview Subject                                     |
|  [Migration planning discussion              ]         |
|                                                        |
|  Planned Slots (add/remove)                            |
|  ┌─────────────────────────┐ ┌─────────────────────────┐
|  │ 2025-08-12  10:00-11:00 │ │ 2025-08-13  14:00-15:00 │
|  └─────────────────────────┘ └─────────────────────────┘
|  [+ Add slot]                                          |
|                                                        |
|  Actual Interview Slot                                 |
|  [2025-08-12  10:00  –  11:00]  (picked from planned)  |
|                                                        |
|  Participants                                          |
|  [☑ Alice P.] [☑ Bob M.] [☐ Carol W.] ...            |
|                                                        |
|  Engagement Manager                                    |
|  [Alice P. ▼]                                          |
|                                                        |
|  Notes for arrangement                                 |
|  ┌──────────────────────────────────────────────────┐  |
|  │ <TipTap editor>                                  │  |
|  │ Please prepare architecture diagrams...          │  |
|  └──────────────────────────────────────────────────┘  |
|                                                        |
|  [Cancel]  [Save Changes]                              |
+--------------------------------------------------------+
```

## Rich Text → Confluence Compatibility

The existing TipTap `RichTextEditor` outputs standard HTML (`<p>`, `<strong>`, `<em>`, `<u>`, `<a>`, `<span style="...">`, `<h1>`–`<h3>`, `<ul>`, `<ol>`, `<li>`, `<br>`, `<blockquote>`, `<code>`). This is **largely compatible** with Confluence’s XHTML-based storage format for basic formatting. When a future export feature is built, an HTML-to-Confluence-XHTML transformer will be needed for Confluence-specific elements (e.g., `<ac:link>`, `<ri:page>` for internal links, macro wrappers). The raw HTML stored in `notes` will serve as the **source of truth**; the export function will transform it at generation time rather than storing a separate Confluence-native format.

## Zoom Meeting Integration (Optional Enhancement)

When an engagement is saved with an actual interview slot, the system can optionally call the Zoom API to automatically schedule a meeting:
- **Backend**: New `app/services/zoom_service.py` to create/update/delete Zoom meetings via Zoom Server-to-Server OAuth app.
- **Config**: Add `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` to backend settings.
- **Trigger**: A "Schedule Zoom Meeting" button in the engagement drawer calls `POST /api/v1/projects/{id}/engagement/zoom` with the actual slot, subject, and participant emails. The backend creates the meeting and stores `zoomMeetingUrl` / `zoomMeetingId` in the engagement JSONB.
- **Update/Delete**: If the actual slot changes, the existing Zoom meeting is updated; if cancelled, it is deleted.
- **Graceful fallback**: If Zoom credentials are not configured, the button is hidden and core engagement functionality works without Zoom. Zoom scheduling is treated as an async best-effort background task (similar to Jira job pattern) so API latency does not block the save operation.

## Approach

1. **Backend — Add `engagement` JSONB column**
   - Add `engagement: Mapped[dict | None] = mapped_column(JSONB, nullable=True)` to `Project` model.
   - Add `engagement` to `ProjectDetail`, `ProjectListItem`, `ProjectHomeItem` schemas.
   - Add `engagement` key to `SECTION_COLUMN_MAP` in `project_service.py`.
   - Add `engagement` to `_project_detail`, `_project_list_item`, `_project_home_item` in `projects.py`.
   - Create Alembic migration to add the column (or reuse JSONB openness if schema-less; prefer explicit migration for consistency).

2. **Frontend — Types & Service**
   - Add `Engagement`, `EngagementSlot` interfaces to `frontend/src/types/index.ts` and include `engagement?: Engagement` in `Project`.
   - Add `engagement` mapping in `frontend/src/services/projects.ts` (`fromApi`, `fromApiListItem`).
   - Add `engagement` label to `SECTION_LABELS` and `FIELD_LABEL_MAPS` in `use-projects.ts` for audit logging.

3. **Frontend — Calendar Page**
   - Create `frontend/src/pages/EngagementCalendarPage.tsx`:
     - Fetch all projects (fields: `basic`, `engagement`, `team`).
     - State: `currentMonth` (Date).
     - Build month grid with `date-fns` (`startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `isSameMonth`, etc.).
     - For each day, collect engagements whose `plannedSlots` or `actualSlot` overlap that day.
     - Render status-colored pills per engagement.
     - Clicking a pill opens the edit drawer for that project.
   - Create `frontend/src/components/engagement/MonthCalendar.tsx` — the grid component.
   - Create `frontend/src/components/engagement/EngagementDrawer.tsx` — the edit sheet.

4. **Frontend — Engagement Drawer**
   - Reuse `SectionEditDrawer` as the shell.
   - Form fields:
     - `Select` for status.
     - `Input` for interview subject.
     - Planned slots: array of rows with date picker (`Calendar` in popover) + time inputs. Add/remove buttons.
     - Actual slot: single row similar to planned slot, or a select that copies from planned slots.
     - Participants: multi-select checkboxes. Populate two groups: platform_migration_lead users (from `GET /users`) and project team members.
     - Engagement manager: single `Select` populated from platform_migration_lead users.
     - Notes: embed `RichTextEditor` component. Strip variable-autocomplete logic (or keep it — it’s harmless). Pass `html={notes ?? ''}` and `onChange={setNotes}`. Use a wrapper that provides a static `onClose` (e.g., blur to close, or keep open inline).
   - On save: call `updateProject(projectId, 'engagement', engagementObj)` via `useProject` pattern, or directly through `apiClient`.
   - `confluencePageUrl` field is read-only in the drawer for now (displayed as a disabled input or hidden until an export feature exists).

5. **Navigation**
   - Add route `/engagements` in `App.tsx`.
   - Add sidebar item "Engagements" above "Waves" in `AppSidebar.tsx`, restricted to `platform_migration_lead` role.

6. **Backend — New endpoint for users by role (optional optimization)**
   - The existing `GET /users` returns all users. Frontend can filter by `user.role.includes('platform_migration_lead')`. No backend change strictly required.

## Files to Modify

| File | Change |
|------|--------|
| `backend/app/models/project.py` | Add `engagement` JSONB column |
| `backend/app/schemas/project.py` | Add `engagement` to ProjectDetail, ProjectListItem, ProjectHomeItem |
| `backend/app/services/project_service.py` | Add `engagement` to `SECTION_COLUMN_MAP` and `SECTION_LABELS` |
| `backend/app/routers/projects.py` | Include `engagement` in `_project_detail`, `_project_list_item`, `_project_home_item` |
| `backend/alembic/versions/0023_add_engagement_to_projects.py` | Alembic migration (new) |
| `frontend/src/types/index.ts` | Add `Engagement`, `EngagementSlot`; extend `Project` |
| `frontend/src/services/projects.ts` | Map `engagement` field in API transformers |
| `frontend/src/hooks/use-projects.ts` | Add `engagement` to `SECTION_LABELS` / `FIELD_LABEL_MAPS` |
| `frontend/src/App.tsx` | Add `/engagements` route |
| `frontend/src/components/layout/AppSidebar.tsx` | Add "Engagements" nav item above "Waves" |
| `frontend/src/pages/EngagementCalendarPage.tsx` | **New** — calendar page shell |
| `frontend/src/components/engagement/MonthCalendar.tsx` | **New** — month grid |
| `frontend/src/components/engagement/EngagementDrawer.tsx` | **New** — edit drawer |
| `frontend/src/components/engagement/RichTextNotes.tsx` | **New** — thin wrapper around `RichTextEditor` for inline notes |
| `frontend/src/components/engagement/ConfluenceExportField.tsx` | **New** — placeholder field for `confluencePageUrl` (read-only until export feature lands) |
| `backend/app/services/zoom_service.py` | **New** — Zoom API client (create/update/delete meetings) |
| `backend/app/routers/zoom.py` | **New** — `POST /projects/{id}/engagement/zoom` endpoint (optional) |

## Reuse

| What | Where | How |
|------|-------|-----|
| JSONB section update pattern | `project_service.py` `SECTION_COLUMN_MAP` / `update_section` | Add `engagement: "engagement"` mapping; updates flow through existing audit/diff logic |
| Frontend section save | `use-projects.ts` `saveSection` | Call `updateProject(id, 'engagement', value)` |
| Drawer shell | `components/drawers/SectionEditDrawer.tsx` | Wrap engagement form |
| Date picker | `components/ui/calendar.tsx` (shadcn/ui) | Popover + Calendar for slot dates |
| Rich text editor | `components/email-builder/builder/canvas/RichTextEditor.tsx` | Wrap with simplified props (`onClose` no-op or inline) |
| Select | `components/ui/select.tsx` | Status, engagement manager |
| API client | `services/client.ts` `apiClient` | GET `/users` to populate lead user lists |
| Background task pattern | `app/services/jira_service.py` | Queue Zoom create/update as background task so save is non-blocking |

## Steps

- [ ] **Step 1**: Backend model + schema + migration
  - Add `engagement` JSONB to `Project` model.
  - Add `engagement` to Pydantic schemas (`confluencePageUrl` included).
  - Add `engagement` to `SECTION_COLUMN_MAP` / `SECTION_LABELS`.
  - Create Alembic migration.
  - Update `projects.py` mappers.

- [ ] **Step 2**: Frontend types + service mapping
  - Add `Engagement`, `EngagementSlot` types.
  - Extend `Project` with `engagement?: Engagement`.
  - Map `engagement` in `services/projects.ts`.
  - Update `use-projects.ts` labels.

- [ ] **Step 3**: Navigation + route
  - Add `/engagements` to `App.tsx`.
  - Add sidebar item in `AppSidebar.tsx`.

- [ ] **Step 4**: Calendar page + month grid
  - Build `EngagementCalendarPage.tsx` fetching all projects.
  - Build `MonthCalendar.tsx` with `date-fns` grid.
  - Display engagement pills per day (color by status).

- [ ] **Step 5**: Engagement edit drawer
  - Build `EngagementDrawer.tsx` with all form fields.
  - Reuse `RichTextEditor` via wrapper.
  - Include read-only `confluencePageUrl` field (or hide until export feature exists).
  - Show "Schedule Zoom Meeting" button when Zoom is configured and an actual slot is set. On click, call Zoom endpoint and update engagement with `zoomMeetingUrl` / `zoomMeetingId`.
  - Connect save to `updateProject('engagement', ...)`.

- [ ] **Step 6**: Zoom integration (optional)
  - Implement `zoom_service.py` with Server-to-Server OAuth token refresh.
  - Add Zoom config to `app/config.py`.
  - Add Zoom router with create/update/delete meeting endpoints.
  - Wire Zoom scheduling into engagement drawer.

- [ ] **Step 7**: Polish & verification
  - Test create, update, month navigation.
  - Verify audit log captures engagement updates.
  - Verify only `platform_migration_lead` sees the page.
  - Test Zoom meeting creation (if credentials configured).

## Verification

1. Log in as a Platform Migration Lead.
2. Navigate to **Engagements** from the sidebar.
3. Click a date in the calendar → drawer opens.
4. Fill status, subject, planned slots, participants, manager, notes. Save.
5. Refresh page — engagement pill appears on correct date(s).
6. Click the pill → drawer reopens with saved values.
7. Change status to `completed` — pill color updates.
8. Check project detail API (`GET /api/v1/projects/{id}`) — `engagement` field present (including `confluencePageUrl`).
9. Check audit log for the project — "engagement" section update recorded.
10. Verify `confluencePageUrl` is preserved across saves (even when empty).
