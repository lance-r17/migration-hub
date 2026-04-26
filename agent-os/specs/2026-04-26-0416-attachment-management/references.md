# References for Admin Attachment Management

## Similar Implementations

### Attachment Service
- **Location:** `backend/app/services/attachment_service.py`
- **Relevance:** Contains `hard_delete_attachment()` which removes DB row + file from disk. Also has `cleanup_orphaned_attachments()` for automatic cleanup.
- **Key patterns:** Use `os.remove()` with OSError handling; `await session.delete(attachment)`

### Admin Router (Service Accounts)
- **Location:** `backend/app/routers/admin.py`
- **Relevance:** All endpoints use `_: User = Depends(require_admin)` for admin-only access.
- **Key patterns:** Keep admin endpoints under `/admin` prefix

### Service Accounts Page
- **Location:** `frontend/src/pages/ServiceAccountsPage.tsx`
- **Relevance:** Full admin page pattern with restricted access, table, dialogs, loading skeletons, toast notifications.
- **Key patterns:** Check `user?.role.includes('admin')` early return; use shadcn/ui Table, Dialog, Button, Skeleton

### Service Accounts API Service
- **Location:** `frontend/src/services/serviceAccounts.ts`
- **Relevance:** Pattern for thin API client wrappers.
- **Key patterns:** `apiClient.get<T>()`, `apiClient.post<T>()`, `apiClient.delete<void>()`

### Use-Service-Accounts Hook
- **Location:** `frontend/src/hooks/use-service-accounts.ts`
- **Relevance:** Pattern for stateful hooks that fetch data and expose CRUD operations.
- **Key patterns:** `useEffect` for initial load; `useCallback` for mutating actions; local state updates after mutations

### App Sidebar
- **Location:** `frontend/src/components/layout/AppSidebar.tsx`
- **Relevance:** Adding new admin nav item with `requiresRole: "admin"`.
- **Key patterns:** Filter items by role before passing to `NavMain`

### App Router
- **Location:** `frontend/src/App.tsx`
- **Relevance:** Adding new route under `/admin/attachments`.
- **Key patterns:** Wrap in `<ProtectedRoute>`
