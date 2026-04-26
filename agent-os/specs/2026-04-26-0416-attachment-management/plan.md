# Plan: Admin Attachment Management

## Spec Folder

`agent-os/specs/2026-04-26-0416-attachment-management/`

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-26-0416-attachment-management/` with:

- **plan.md** — This full plan
- **shape.md** — Shaping notes (scope, decisions, context)
- **standards.md** — N/A (no formal standards directory exists in this project)
- **references.md** — Pointers to reference implementations studied
- **visuals/** — Empty (no mockups provided)

---

## Task 2: Backend — Admin Attachment List & Bulk Hard-Delete Endpoints

### 2a. Schema
Create `backend/app/schemas/admin_attachment.py`:
- `AdminAttachmentOut` — extends `AttachmentOut` with `project_name: str`
- `BulkDeleteAttachmentsRequest` — `ids: list[str]`
- `BulkDeleteAttachmentsResponse` — `deleted: int`, `not_found: list[str]`

### 2b. Service functions
Add to `backend/app/services/attachment_service.py`:
- `get_all_attachments(session, status_filter=None)` — returns all attachments joined with Project name, ordered by created_at desc
- `bulk_hard_delete_attachments(session, ids)` — fetches each attachment by ID, calls `hard_delete_attachment` for each, returns counts and any IDs not found

### 2c. Router endpoints
Add to `backend/app/routers/admin.py`:
- `GET /admin/attachments` — `response_model=list[AdminAttachmentOut]`
  - Optional query param `status` ("pending" | "deleted" | "confirmed")
  - Protected by `require_admin`
  - Joins `ProjectAttachment` with `Project` to include `project_name`
- `POST /admin/attachments/bulk-delete` — `response_model=BulkDeleteAttachmentsResponse`
  - Protected by `require_admin`
  - Accepts list of attachment IDs
  - Calls `bulk_hard_delete_attachments`, commits, returns results

---

## Task 3: Frontend — API Service & Hook

### 3a. Type definitions
Create `frontend/src/types/attachment.ts`:
```ts
export interface Attachment {
  id: string
  projectId: string
  projectName: string
  filename: string
  filePath: string
  status: 'pending' | 'confirmed' | 'deleted'
  createdAt: string | null
}
```

### 3b. Service
Create `frontend/src/services/attachments.ts`:
- `getAllAttachments(status?: string): Promise<Attachment[]>` → `GET /api/v1/admin/attachments?status=...`
- `bulkDeleteAttachments(ids: string[]): Promise<{ deleted: number; notFound: string[] }>` → `POST /api/v1/admin/attachments/bulk-delete`

### 3c. Hook
Create `frontend/src/hooks/use-attachments.ts`:
- State: `attachments`, `loading`, `error`, `selectedIds` (string[])
- Fetches on mount with optional status filter
- `toggleSelection(id)`, `selectAll(ids)`, `clearSelection()`
- `bulkDelete(ids)` — calls service, refreshes list, clears selection

---

## Task 4: Frontend — AdminAttachmentsPage

Create `frontend/src/pages/AdminAttachmentsPage.tsx`:

- **Access control**: Same pattern as `ServiceAccountsPage` — check `user?.role.includes('admin')`, render restricted view if not admin
- **Page title**: "Attachment Management"
- **Subtitle**: "Review and permanently delete project attachments across all projects."
- **Filters**: Status filter tabs/buttons — "All" | "Pending" | "Deleted" | "Confirmed" — clicking updates the fetched list
- **Table columns**:
  - Checkbox (select row)
  - Filename
  - Project Name
  - Status (badge)
  - Created At (formatted date)
- **Bulk action bar**: When rows are selected, show a floating/action bar with:
  - "X selected" text
  - "Permanently Delete" button (destructive style)
  - "Clear Selection" button
- **Delete confirmation dialog**: Warn that this permanently removes files from disk and cannot be undone
- **Empty states**: Show appropriate message per filter
- **Loading**: Skeleton rows while loading

Follow UI patterns from `ServiceAccountsPage` (shadcn/ui Table, Dialog, Button, Skeleton, toast notifications).

---

## Task 5: Frontend — Wire Up Route & Navigation

### 5a. Sidebar
Update `frontend/src/components/layout/AppSidebar.tsx`:
- Add nav item: `{ title: "Attachments", url: "/admin/attachments", icon: <Paperclip />, requiresRole: "admin" }`
- Import `Paperclip` from `lucide-react`

### 5b. Routing
Update `frontend/src/App.tsx`:
- Import `AdminAttachmentsPage`
- Add route: `<Route path="/admin/attachments" element={<ProtectedRoute><AdminAttachmentsPage /></ProtectedRoute>} />`

---

## Task 6: Validate End-to-End

Manual testing checklist:
1. Log in as non-admin → sidebar does not show "Attachments", direct URL navigation shows restricted view
2. Log in as admin → sidebar shows "Attachments"
3. Admin page loads with all attachments across all projects
4. Status filters work correctly (All, Pending, Deleted, Confirmed)
5. Row selection works (individual checkbox, no "select all across pages" needed for MVP)
6. Bulk delete permanently removes selected attachments from DB and disk
7. After delete, list refreshes and selection clears
8. Toast notifications show success/error
9. Verify no 404s or console errors

---

## Key Decisions

- **Endpoint location**: Added to existing `admin.py` router (prefix `/admin`) to keep all admin endpoints together, following the `ServiceAccountsPage` → `/admin/service-accounts` pattern.
- **Hard delete only**: The bulk action performs hard delete (DB row + file removal) because the user explicitly wants to "housekeep" pending and soft-deleted files. This is different from the project-scoped `DELETE` endpoint which only soft-deletes.
- **Global view**: Lists ALL attachments across ALL projects (not per-project) because admin needs oversight.
- **No pagination for MVP**: Follows `ServiceAccountsPage` pattern — simple table with all results. Can be added later if attachment volume grows.
- **Audit logging**: Skip audit logging for admin bulk delete to keep scope minimal. The existing soft-delete endpoint already audits user-initiated deletes.

---

## References

- Attachment model: `backend/app/models/project_attachment.py`
- Attachment service: `backend/app/services/attachment_service.py`
- Attachment schema: `backend/app/schemas/project_attachment.py`
- Admin auth dependency: `backend/app/auth.py` (`require_admin`)
- Admin router pattern: `backend/app/routers/admin.py`
- Frontend admin page pattern: `frontend/src/pages/ServiceAccountsPage.tsx`
- Frontend service pattern: `frontend/src/services/serviceAccounts.ts`
- Frontend hook pattern: `frontend/src/hooks/use-service-accounts.ts`
- Sidebar gating: `frontend/src/components/layout/AppSidebar.tsx`
- Routing: `frontend/src/App.tsx`
