# Early Access Experience — Local Account

## Context

New "Early Access Experience" capability for a new cloud environment:
1. **Admin side** (`frontend/src/pages/UserAccountsPage.tsx`): the existing edit dialog gains an "Early Access Experience" section **between "Profile" and "Project Governance Roles"**, allowing the admin to create **one (and at most one)** local account per user. Fields: account name + initial password. The password can be **updated** later but is **never returned** on load. The account can also be removed. Account name is **immutable after creation**.
2. **User side**: a new profile page at `/account`, opened from the left sidebar user dropdown → "Account" (`NavUser.tsx`). Two sections:
   - **General** — read-only profile info.
   - **Early Access Experience** — shows the local account (if any): one row, two columns of immutable inputs (account name, password masked by default with eye-toggle), both with copy buttons. **This is the only place in the system where the password is retrievable** (owner-only).

### Confirmed decisions
- Password stored as **plaintext** in the DB (accepted tradeoff).
- Admin can **remove** the local account; **account name immutable** once created.
- Default account name: **`{user_id}-poc`**, **globally unique** across all users.
- General section is **read-only**.
- Route: `/account`; "Notifications" dropdown item stays as-is.

## Approach

### Backend (FastAPI + SQLAlchemy + Alembic)

**New table `user_local_accounts`** (1:1 with `users`):
- `user_id` String, PK, FK → `users.id` `ondelete="CASCADE"` (so `delete_user` in `admin.py` needs no extra cleanup)
- `account_name` String, **unique**, not null
- `password` String, not null (plaintext)
- `created_at`, `updated_at` DateTime (match existing timestamp conventions in other models)

**New model** `backend/app/models/user_local_account.py` (`UserLocalAccount`), plus a one-to-one `relationship` on `User` (`backend/app/models/user.py`).

**New schemas** `backend/app/schemas/local_account.py`:
- `LocalAccountCreate { account_name: str, password: str }` (min-length validation)
- `LocalAccountUpdate { password: str }`
- `LocalAccountAdminOut { user_id, account_name, created_at, updated_at }` — **no password**
- `LocalAccountOwnerOut { account_name, password }` — owner only

**New endpoints:**
- In `backend/app/routers/admin.py` (all `require_admin`):
  - `GET /admin/users/{user_id}/local-account` → 200 `LocalAccountAdminOut` (no password), 404 if none
  - `POST /admin/users/{user_id}/local-account` (201) → create; 409 if user already has one; 409 if `account_name` taken globally; 404 if user not found
  - `PUT /admin/users/{user_id}/local-account` → update **password only**; 404 if none
  - `DELETE /admin/users/{user_id}/local-account` (204); 404 if none
- In `backend/app/routers/users.py`:
  - `GET /users/me/local-account` → 200 `LocalAccountOwnerOut` (**includes password**), 404 if none; uses `get_current_user` (owner-only)

**Migration** `backend/alembic/versions/0038_add_user_local_accounts.py`, `down_revision = "0037"` (current head; the hash-named revisions interleave back into the numeric chain, 0037 is the tip).

### Frontend (React + shadcn/ui)

**`UserAccountsPage.tsx`** — new section in the edit dialog between Profile and Project Governance Roles, following the governance-roles pattern (acts immediately, independent of "Save Changes"):
- On `openEdit`, fetch `GET /admin/users/{id}/local-account`.
- **No account**: two inputs — Account Name (prefilled with `{user.id}-poc`, editable) and Initial Password (required) + "Create" button. Errors (e.g. 409 name taken) shown via toast/inline error.
- **Account exists**: account name shown in a disabled input; password input always **empty** (placeholder "Enter new password to update") with an "Update Password" button (disabled while empty); a remove (X / trash) button deletes the account with a toast (no extra confirm — matches governance-role removal pattern).

**New `frontend/src/pages/AccountPage.tsx`** at route `/account` (registered in `App.tsx`, wrapped in `ProtectedRoute`, layout via `AppShell` like `AdminPage.tsx`):
- **General** section: read-only (disabled) inputs from `useCurrentUser()`: Name, Email, Department, Team, Initials, Roles.
- **Early Access Experience** section: `GET /users/me/local-account` on mount; 404 → empty-state text ("No local account provisioned"). Otherwise one row, two columns: immutable inputs for account name and password (`type="password"` default, eye icon toggles visibility), each with a copy button — copy pattern reused from `ServiceAccountsPage.tsx` (`navigator.clipboard.writeText` + Copy/Check icon swap, lines ~149–153, 397–399).

**`NavUser.tsx`**: add `onClick={() => navigate('/account')}` to the existing "Account" `DropdownMenuItem` (line ~100). "Notifications" untouched.

**Services**:
- `frontend/src/services/adminUsers.ts`: add `getLocalAccount`, `createLocalAccount`, `updateLocalAccountPassword`, `deleteLocalAccount` (typed interfaces, `apiClient`, no mock — matches file's existing style).
- `frontend/src/services/users.ts`: add `getMyLocalAccount` via `apiClient` (owner endpoint).

## Files to modify

- `backend/alembic/versions/0038_add_user_local_accounts.py` (new)
- `backend/app/models/user_local_account.py` (new)
- `backend/app/models/user.py` (add relationship)
- `backend/app/schemas/local_account.py` (new)
- `backend/app/routers/admin.py` (4 endpoints)
- `backend/app/routers/users.py` (1 endpoint)
- `frontend/src/pages/UserAccountsPage.tsx` (new dialog section)
- `frontend/src/pages/AccountPage.tsx` (new)
- `frontend/src/components/layout/NavUser.tsx` (Account onClick)
- `frontend/src/App.tsx` (route)
- `frontend/src/services/adminUsers.ts`, `frontend/src/services/users.ts`

## Reuse

- `require_admin` / `get_current_user` — `backend/app/auth.py`
- Service-account copy/clipboard pattern — `frontend/src/pages/ServiceAccountsPage.tsx:149-153,397-399`
- `AppShell` page layout pattern — `frontend/src/pages/AdminPage.tsx`
- FK/model conventions — `backend/app/models/project_user.py`; migration conventions — `backend/alembic/versions/0015_add_service_account_to_users.py`
- `apiClient` — `frontend/src/services/client.ts`; `useCurrentUser` — `frontend/src/context/UserContext.tsx`

## Steps

- [x] Backend: migration 0038 + `UserLocalAccount` model + `User` relationship
- [x] Backend: schemas (`local_account.py`)
- [x] Backend: admin endpoints (GET/POST/PUT/DELETE `/admin/users/{id}/local-account`)
- [x] Backend: owner endpoint (`GET /users/me/local-account`, returns password)
- [x] Frontend: service functions in `adminUsers.ts` / `users.ts`
- [x] Frontend: "Early Access Experience" section in User Accounts edit dialog (create / update password / remove)
- [x] Frontend: `AccountPage.tsx` (General read-only + Early Access Experience with mask/copy)
- [x] Frontend: route `/account` in `App.tsx`; wire "Account" menu item in `NavUser.tsx`

## Verification

- `cd backend && alembic upgrade head` — table created
- `cd backend && pytest` — existing suite passes; add a small test for the new endpoints (create → 409 duplicate user, 409 duplicate account_name, owner GET returns password, admin GET does not)
- `cd frontend && npm run build` (or `tsc`) — type checks pass
- Manual E2E:
  1. Admin → User Accounts → edit a user → Early Access Experience: account name prefilled `{id}-poc`, create with password → toast success
  2. Reopen dialog → account name disabled, password field empty; update password; remove account
  3. Log in as that user → sidebar dropdown → Account → General section shows read-only profile; Early Access Experience shows account name + masked password; eye toggle reveals; copy buttons work
  4. Confirm admin GET never exposes password; owner GET is the only password-returning endpoint
