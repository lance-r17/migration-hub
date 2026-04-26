# Plan: Service Account Management (Admin-Only)

## Context

The backend already has partial service account APIs in `backend/app/routers/admin.py`:
- `POST /admin/service-accounts` — create
- `GET /admin/service-accounts` — list
- `DELETE /admin/service-accounts/{id}` — revoke (soft, sets `api_key_hash = null`)

The user wants a full admin-only UI for managing service accounts with **hard delete**, **update**, and **token reset** capabilities. Access must be restricted to users with the exact role `"admin"` (stricter than the existing `require_admin` which also allows `platform_migration_lead`).

The page will live at `/admin/service-accounts` as a standalone admin page (not under `/settings`).

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-24-0815-service-account-management/` with:

- **plan.md** — this plan
- **shape.md** — shaping notes (scope, decisions, strict admin-only role requirement, hard-delete preference)
- **standards.md** — relevant patterns from the codebase (FastAPI router patterns, React hooks/services pattern, shadcn/ui table/dialog patterns)
- **references.md** — pointers to `backend/app/routers/admin.py`, `frontend/src/components/settings/EmbargoSection.tsx`, `frontend/src/hooks/use-embargos.ts`
- **visuals/** — empty (no mockups provided)

---

## Task 2: Extend Backend Admin Router

**Files:** `backend/app/routers/admin.py`, `backend/app/schemas/service_account.py`, `backend/app/auth.py`

1. **Update `_ADMIN_ROLES`** in `backend/app/auth.py`:
   - Change `_ADMIN_ROLES = {"admin"}` (remove `platform_migration_lead`).
   - `require_admin` now enforces strictly `"admin"`.
   - The existing Jira admin endpoint already uses `require_admin`; after this change it also becomes admin-only.

2. **Extend schemas** in `backend/app/schemas/service_account.py`:
   - `ServiceAccountUpdate` — `name`, `email`, `department` (all optional)
   - `ServiceAccountTokenReset` — response with `id` + `api_key` (plaintext, shown once)

3. **Extend router** in `backend/app/routers/admin.py`:
   - `PATCH /admin/service-accounts/{user_id}` — update name/email/department. Check email uniqueness if changed. Use `require_admin`.
   - `DELETE /admin/service-accounts/{user_id}` — **hard delete** the user row from DB. Use `require_admin`.
   - `POST /admin/service-accounts/{user_id}/reset-token` — generate new API key pair, update `api_key_hash`, return plaintext key once. Use `require_admin`.
   - Existing create/list endpoints already use `require_admin`; no further change needed after `_ADMIN_ROLES` is updated.

---

## Task 3: Add Frontend Types and Service Layer

**Files:** `frontend/src/types/serviceAccount.ts` (new), `frontend/src/services/serviceAccounts.ts` (new)

1. **Types:**
   ```ts
   export interface ServiceAccount {
     id: string
     name: string
     email: string
     department: string
     initials: string
   }

   export interface ServiceAccountCreate {
     name: string
     email: string
     department: string
   }

   export interface ServiceAccountUpdate {
     name?: string
     email?: string
     department?: string
   }

   export interface ServiceAccountTokenReset {
     id: string
     api_key: string
   }
   ```

2. **Service layer** following the pattern in `frontend/src/services/embargos.ts`:
   - `getServiceAccounts()` → `GET /api/v1/admin/service-accounts`
   - `createServiceAccount(data)` → `POST /api/v1/admin/service-accounts`
   - `updateServiceAccount(id, data)` → `PATCH /api/v1/admin/service-accounts/{id}`
   - `deleteServiceAccount(id)` → `DELETE /api/v1/admin/service-accounts/{id}`
   - `resetServiceAccountToken(id)` → `POST /api/v1/admin/service-accounts/{id}/reset-token`

---

## Task 4: Build the Service Accounts Admin Page

**Files:** `frontend/src/hooks/use-service-accounts.ts` (new), `frontend/src/pages/ServiceAccountsPage.tsx` (new)

1. **Hook** `use-service-accounts.ts` following `use-embargos.ts` pattern:
   - State: `serviceAccounts`, `loading`, `error`
   - Actions: `create`, `update`, `delete`, `resetToken` that mutate local state after API success.

2. **Page** `ServiceAccountsPage.tsx`:
   - Uses `AppShell` with title "Service Accounts"
   - Admin-only guard: if `!user?.role.includes('admin')`, render an access-denied view (similar to `SettingsPage` but checking for `"admin"` exactly).
   - Table layout using shadcn/ui `Table` component with columns: Name, Email, Department, Initials, Actions.
   - **Actions per row:**
     - Edit (pencil icon) → opens dialog/drawer with form pre-filled
     - Delete (trash icon) → confirmation dialog, then hard delete
     - Reset Token (key icon) → confirmation dialog, then show plaintext token in a dismissible alert/dialog (copy-to-clipboard button)
   - **Top action:** "New Service Account" button → opens create dialog/drawer
   - Use `Dialog` for create/edit forms and `toast` for success/error feedback.
   - After create/reset-token, display the plaintext API key in a modal with a "Copy" button and a "I have copied this" dismiss action (key is shown once).

---

## Task 5: Wire Up Routing and Navigation

**Files:** `frontend/src/App.tsx`, `frontend/src/components/layout/AppSidebar.tsx`

1. **App.tsx:**
   - Add route: `/admin/service-accounts` → `<ServiceAccountsPage />` inside `<ProtectedRoute>`

2. **AppSidebar.tsx:**
   - Add nav item: `{ title: "Service Accounts", url: "/admin/service-accounts", icon: <Key />, requiresRole: "admin" }`
   - Import `Key` from `lucide-react`.

---

## Task 6: Verify End-to-End

1. Run backend and frontend locally.
2. Log in as a user with `role: "admin"`.
3. Navigate to "Service Accounts" in the sidebar.
4. Verify:
   - Create a service account → API key is shown once and copyable.
   - List shows the new account.
   - Update name/department → reflects in list.
   - Reset token → new API key is shown once, old key no longer works.
   - Delete → account disappears from list and DB.
5. Log in as `platform_migration_lead` (without `admin`):
   - Verify the "Service Accounts" nav item is hidden.
   - Direct navigation to `/admin/service-accounts` shows access denied.
   - Direct API calls return 403.

---

## Decisions

- **Hard delete**: Service accounts are fully removed from the DB on delete (user confirmed).
- **Strict role**: Only `"admin"` can access; `_ADMIN_ROLES` is narrowed to `{"admin"}` and `require_admin` is reused for all admin endpoints (service accounts and Jira jobs).
- **Page placement**: `/admin/service-accounts` standalone page (user confirmed).
- **Token display**: Plaintext API key shown once in a modal after create or reset; backend never stores plaintext.
