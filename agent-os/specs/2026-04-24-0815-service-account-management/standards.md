# Standards for Service Account Management

The following standards and patterns apply to this work.

---

## Backend Patterns

### FastAPI Router Structure

- Routers live in `backend/app/routers/`
- Use `APIRouter(prefix="/admin", tags=["admin"])`
- Use `Depends(require_admin)` for admin-only routes
- Return appropriate status codes: `201` for create, `204` for delete, `200` for update

### Schema Patterns

- Pydantic models in `backend/app/schemas/service_account.py`
- Separate models for create/update/out responses
- Plaintext secrets only returned on creation/token-reset, never on list/get

### Auth Patterns

- `_ADMIN_ROLES` controls who can access admin endpoints
- `require_admin` is reused; no separate dependencies

---

## Frontend Patterns

### Service Layer

- Services live in `frontend/src/services/`
- Export typed async functions using `apiClient.get/post/patch/delete`
- Handle mock mode with `USE_MOCK` check (optional for admin-only features)

### Hooks

- Hooks live in `frontend/src/hooks/`
- Return `{ data, loading, error }` plus action callbacks
- Actions update local state optimistically after API success

### UI Patterns

- Use shadcn/ui `Table`, `Dialog`, `Button`, `Badge`, `Skeleton`
- Use `toast` from `sonner` for success/error feedback
- Use `AppShell` for page layout
- Role-based access: check `user?.role.includes('admin')`
