# In-App Notifications — Early Access Experience Events

## Context

Implement the "Notifications" item in the user dropdown menu (`frontend/src/components/layout/NavUser.tsx`, currently a no-op). This is a **greenfield in-app notification system** — nothing exists today (no table, endpoints, or UI; the existing admin "Notifications" page is email-only).

**First notification capability:** when an admin **creates a local account** or **updates its initial password** (Early Access Experience — see `plans/early-access-local-account.md`), the affected user gets a notification whose details link to `/account`.

**Also:** `AccountPage.tsx` gains a tip under the password: the initial password is for **first login only** and **must be changed in the new cloud platform** after first successful login.

### Confirmed decisions
- Notifications UI = **dedicated page** at `/notifications`.
- Track **read/unread**; **unread count badge** on the "Notifications" menu item.
- Users can **delete/dismiss** individual notifications; **retention limit configurable by admin**.
- Notification wording (approx.):
  - Created: title *"Early Access: Local Account Created"*, message *"A local account `<name>` has been provisioned for you for the new cloud environment."*, link `/account`
  - Password updated: title *"Early Access: Initial Password Updated"*, message *"The initial password for your local account `<name>` has been updated."*, link `/account`

## Approach

### Backend

**1. Migration `0039_add_notifications.py`** (down_revision `"0038"`) — new `notifications` table:
- `id` String PK (uuid hex), `user_id` String FK → `users.id` `ondelete="CASCADE"` (indexed), `type` String, `title` String, `message` String (Text), `link` String nullable, `read_at` DateTime(tz) nullable, `created_at` DateTime(tz) server_default now()

**2. Model** `backend/app/models/notification.py` (`Notification`), registered in `models/__init__.py`.

**3. Schemas** `backend/app/schemas/notification.py`:
- `NotificationOut { id, type, title, message, link, read_at, created_at }`
- `NotificationConfig { retention_limit: int (≥1) }`

**4. Service** `backend/app/services/notification_service.py`:
- `create_notification(db, user_id, type, title, message, link)` — insert, then **prune**: delete the user's oldest notifications beyond the configured retention limit.
- `get_notification_config` / `set_notification_config` — `config_store` key `notification_config`, default `{"retention_limit": 50}`, merge-with-defaults + `flag_modified` pattern copied from `email_event_config_service.py`.

**5. Router** `backend/app/routers/notifications.py` (prefix `/notifications`, all `get_current_user`, owner-scoped):
- `GET ""` → list current user's notifications, newest first
- `GET /unread-count` → `{ count: int }` (lightweight, for the badge)
- `POST /{notification_id}/read` → mark read (404 if not found / not owned)
- `POST /read-all` → mark all read
- `DELETE /{notification_id}` → dismiss (404 if not found / not owned)

**6. Admin config endpoints** in `backend/app/routers/admin.py` (`require_admin`):
- `GET /admin/notification-config` → `NotificationConfig`
- `PUT /admin/notification-config` → update retention limit

**7. Event hooks** in `admin.py`: after successful `flush()` in `create_local_account` and `update_local_account`, call `create_notification(...)` with the wording above.

**8. Register** `notifications.router` in `backend/app/main.py`.

### Frontend

**1. Service** `frontend/src/services/notifications.ts`: `getNotifications`, `getUnreadCount`, `markRead`, `markAllRead`, `deleteNotification`, plus admin `getNotificationConfig` / `updateNotificationConfig` (`apiClient`, no mock — matches `adminUsers.ts` style).

**2. Page** `frontend/src/pages/NotificationsPage.tsx` at `/notifications` (`AppShell`, `ProtectedRoute`):
- Header (Bell icon + title) with a "Mark all as read" button (hidden/disabled when no unread).
- List rows: unread = dot indicator + semibold title; read = muted. Row shows title, message, timestamp. Per-row delete (X) button.
- Clicking a row marks it read and navigates to `link` if present.
- Empty state: "No notifications."
- After mutations, dispatch `window.dispatchEvent(new Event('notifications-changed'))` so the badge refreshes.

**3. `NavUser.tsx`**: "Notifications" item → `navigate('/notifications')`; render unread count `Badge` next to the label when count > 0. Count fetched on mount, re-fetched every **60s** (interval) and on the `notifications-changed` window event. No websockets.

**4. `App.tsx`**: route `/account` exists → add `/notifications` the same way.

**5. `AccountPage.tsx`**: info callout under the password field (replace/extend the existing hint): *"This initial password is for your first login to the new cloud platform only. You must change it in the new cloud platform immediately after your first successful login."*

**6. `NotificationSettingsPage.tsx`** (`/admin/notifications`): new **"In-App Notifications"** card (matching the page's existing card style) with a numeric "Retention limit (per user)" input + Save button, wired to the admin config endpoints.

## Files to modify

**Backend**
- `backend/alembic/versions/0039_add_notifications.py` (new)
- `backend/app/models/notification.py` (new), `backend/app/models/__init__.py`
- `backend/app/schemas/notification.py` (new)
- `backend/app/services/notification_service.py` (new)
- `backend/app/routers/notifications.py` (new)
- `backend/app/routers/admin.py` (config endpoints + event hooks)
- `backend/app/main.py` (router registration)
- `backend/tests/test_notifications.py` (new)

**Frontend**
- `frontend/src/services/notifications.ts` (new)
- `frontend/src/pages/NotificationsPage.tsx` (new)
- `frontend/src/components/layout/NavUser.tsx` (navigate + unread badge)
- `frontend/src/App.tsx` (route)
- `frontend/src/pages/AccountPage.tsx` (first-login tip)
- `frontend/src/pages/NotificationSettingsPage.tsx` (retention-limit card)

## Reuse

- Config-store get/set + merge-defaults pattern — `backend/app/services/email_event_config_service.py`
- FK cascade + migration conventions — `backend/app/models/user_local_account.py`, `backend/alembic/versions/0038_add_user_local_accounts.py`
- `require_admin` / `get_current_user` — `backend/app/auth.py`; router registration — `backend/app/main.py:193-215`
- Test client/auth-override pattern — `backend/tests/test_local_accounts.py`
- `Badge` component + card layout — `frontend/src/pages/NotificationSettingsPage.tsx`
- `AppShell` page pattern — `frontend/src/pages/AccountPage.tsx`

## Steps

- [x] Backend: migration 0039 + `Notification` model + registration
- [x] Backend: schemas + `notification_service` (create + prune, config get/set)
- [x] Backend: `/notifications` router (list, unread-count, read, read-all, delete) + register in `main.py`
- [x] Backend: admin config endpoints + hooks in `create_local_account` / `update_local_account`
- [x] Backend: tests (`test_notifications.py`)
- [x] Frontend: `services/notifications.ts`
- [x] Frontend: `NotificationsPage.tsx` + route + NavUser item with unread badge
- [x] Frontend: AccountPage first-login tip + retention card in NotificationSettingsPage

## Verification

- `cd backend && alembic upgrade head` → `notifications` table created
- `cd backend && pytest tests/test_notifications.py` — covers: notification created on account create & password update, owner-only list/read/delete, unread count, retention pruning (set limit=2, create 3, oldest pruned), admin config get/put
- `cd backend && pytest` — no regressions (2 pre-existing `test_category_milestones` failures expected)
- `cd frontend && npx tsc -p tsconfig.app.json --noEmit` — 0 errors in touched files (66 pre-existing errors elsewhere)
- Manual E2E:
  1. Admin creates/updates a user's local account → that user's "Notifications" menu shows badge
  2. User opens `/notifications` → sees notification, clicks it → marked read + lands on `/account`
  3. Delete a notification; "Mark all as read"; badge clears
  4. Admin sets retention limit in `/admin/notifications` → new events prune old ones
  5. `/account` shows the first-login password tip
