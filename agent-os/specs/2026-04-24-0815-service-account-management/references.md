# References for Service Account Management

## Similar Implementations

### Admin Router (`backend/app/routers/admin.py`)

- **Location:** `backend/app/routers/admin.py`
- **Relevance:** Existing create/list/revoke endpoints for service accounts. Extended with update, hard delete, and token reset.
- **Key pattern:** `_make_api_key()` generates plaintext + SHA-256 hash; `require_admin` guards all routes.

### EmbargoSection (`frontend/src/components/settings/EmbargoSection.tsx`)

- **Location:** `frontend/src/components/settings/EmbargoSection.tsx`
- **Relevance:** Table + Dialog + Drawer CRUD pattern used as template for the service accounts page.
- **Key pattern:** `useState` for form/delete targets; `Dialog` for confirmations; `Table` for listing.

### use-embargos Hook (`frontend/src/hooks/use-embargos.ts`)

- **Location:** `frontend/src/hooks/use-embargos.ts`
- **Relevance:** Pattern for local-state management hook wrapping service calls.
- **Key pattern:** `useState` for `{ data, loading, error }`; `useCallback` for mutating actions that update local state after API success.
