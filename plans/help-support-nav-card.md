# Custom Navigation Card for Help & Support

## Context
Replace the current **Help & Support** item in the sidebar with a card-style navigation element that opens an external URL in a new tab. The card’s title, description, and URL must be editable from a new settings page at `/settings/nav-card` and visible to both `platform_migration_lead` and `admin` users.

## Approach
1. **Persistence**: Store the card configuration in the existing `config_store` table using a new key (`custom_nav_card`), following the same pattern as migration settings.
2. **Backend API**: Add `GET /api/v1/settings/nav-card` and `PUT /api/v1/settings/nav-card` endpoints with Pydantic schemas and a small service layer.
3. **Frontend data layer**: Add a `CustomNavCardConfig` type, a service module, and mock-store support.
4. **Global state**: Create a `CustomNavCardProvider` so the sidebar can react to changes after the user saves on the settings page.
5. **Sidebar UI**: Replace the `NavSecondary` Help & Support item with a compact clickable card that uses the existing `Card` primitives and an `ExternalLink` icon.
6. **Settings UI**: Create a dedicated `CustomNavCardSettingsPage` with title/description/URL inputs and add it to `/settings/nav-card`. Also add its entry on the `/settings` home grid.
7. **Access control**: Update the `SettingsPage` guard so both `platform_migration_lead` and `admin` can access settings.

## Reuse
- **Backend**: `backend/app/models/config_store.py` for JSONB key/value storage; `backend/app/services/migration_settings_service.py` as the get/update/default template.
- **Frontend UI**: `frontend/src/components/ui/card.tsx` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`), `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/input.tsx`, `frontend/src/components/ui/label.tsx`, `frontend/src/components/ui/breadcrumb.tsx`.
- **Frontend state**: Mirror `frontend/src/context/MigrationSettingsContext.tsx` for the new provider.
- **Frontend routing**: Add a child route under the existing `/settings` route in `frontend/src/App.tsx`, mirroring the other settings pages.

## Files to Modify

### Backend
- `backend/app/schemas/custom_nav_card.py` *(new)* — Pydantic input/output models.
- `backend/app/services/custom_nav_card_service.py` *(new)* — get/update with defaults.
- `backend/app/routers/custom_nav_card.py` *(new)* — `GET`/`PUT /settings/nav-card` endpoints.
- `backend/app/main.py` — register the new router under `/api/v1`.

### Frontend
- `frontend/src/types/settings.ts` *(or `frontend/src/types/customNavCard.ts`)* — add `CustomNavCardConfig` interface.
- `frontend/src/services/customNavCard.ts` *(new)* — API service using `apiClient`.
- `frontend/src/data/store.ts` — add mock getters/setters for the nav-card config.
- `frontend/src/context/CustomNavCardContext.tsx` *(new)* — global provider/consumer.
- `frontend/src/App.tsx` — wrap app with `CustomNavCardProvider`; add `/settings/nav-card` route.
- `frontend/src/components/layout/AppSidebar.tsx` — render the custom card instead of Help & Support.
- `frontend/src/pages/CustomNavCardSettingsPage.tsx` *(new)* — settings form page.
- `frontend/src/pages/SettingsHome.tsx` — add the new settings section card.
- `frontend/src/pages/SettingsPage.tsx` — allow `admin` in addition to `platform_migration_lead`.

## Steps

### Backend
- [ ] Create `backend/app/schemas/custom_nav_card.py`:
  - `CustomNavCardOut`: `title: str`, `description: str`, `url: str`.
  - `CustomNavCardUpdate`: same fields, all optional for partial updates.
- [ ] Create `backend/app/services/custom_nav_card_service.py`:
  - Key: `"custom_nav_card"`.
  - Defaults:
    - `title`: `"Help & Support"`
    - `description`: `"Open the support portal for guides, FAQs, and assistance."`
    - `url`: `"https://example.com/support"`
  - `get_custom_nav_card(session)` returns current or default config.
  - `update_custom_nav_card(session, patch)` merges provided fields and persists via `ConfigStore`.
- [ ] Create `backend/app/routers/custom_nav_card.py`:
  - `router = APIRouter(prefix="/settings", tags=["settings"])`.
  - `GET /nav-card` → `CustomNavCardOut`.
  - `PUT /nav-card` → `CustomNavCardOut`.
- [ ] Register router in `backend/app/main.py`:
  - `from app.routers import custom_nav_card`
  - `app.include_router(custom_nav_card.router, prefix=prefix)` alongside billing router.

### Frontend types & services
- [ ] Add `CustomNavCardConfig` interface (e.g. in `frontend/src/types/settings.ts`):
  - `title`, `description`, `url`.
- [ ] Create `frontend/src/services/customNavCard.ts`:
  - `getCustomNavCardConfig()` → `GET /api/v1/settings/nav-card`.
  - `saveCustomNavCardConfig(config)` → `PUT /api/v1/settings/nav-card`.
  - Support `USE_MOCK` by reading/writing `store`.
- [ ] Update `frontend/src/data/store.ts`:
  - Add `_customNavCardConfig` default.
  - Expose `getCustomNavCardConfig()` and `setCustomNavCardConfig(config)`.

### Frontend state
- [ ] Create `frontend/src/context/CustomNavCardContext.tsx`:
  - Provide `{ config, loading, refresh }`.
  - Load on auth success, similar to `MigrationSettingsContext`.
- [ ] Wrap the app in `frontend/src/App.tsx` with `<CustomNavCardProvider>`.

### Sidebar card
- [ ] Update `frontend/src/components/layout/AppSidebar.tsx`:
  - Remove the **Help & Support** item from `data.navSecondary`.
  - Import `ExternalLink` from `lucide-react` and `Card` primitives.
  - Use `useCustomNavCardContext()` to read config.
  - Render a clickable card inside the sidebar content:
    - `target="_blank" rel="noopener noreferrer"` on the anchor.
    - Title and description from config.
    - `ExternalLink` icon in `CardAction`.
- [ ] Keep `NavSecondary` if other secondary items may be added later, but render it only when `items.length > 0`.

### Settings page
- [ ] Create `frontend/src/pages/CustomNavCardSettingsPage.tsx`:
  - Breadcrumb: Settings → Custom Navigation Card.
  - Form card with inputs for Title, Description, and URL.
  - Save button calls `saveCustomNavCardConfig` and `refresh()` from context.
  - Toast success / error feedback.
- [ ] Add route in `frontend/src/App.tsx`:
  - `<Route path="nav-card" element={<CustomNavCardSettingsPage />} />` inside `/settings`.
- [ ] Add entry in `frontend/src/pages/SettingsHome.tsx`:
  - Title: `"Custom Navigation Card"`
  - Description: `"Configure the sidebar card that links users to external help or resources."`
  - Icon: `<ExternalLink size={20} className="text-primary" />`
  - `href: '/settings/nav-card'`
- [ ] Update `frontend/src/pages/SettingsPage.tsx`:
  - Change guard to allow `admin` role as well: block only if user lacks both `platform_migration_lead` and `admin`.
  - Update the restricted message if desired.

## Verification
- [ ] Start the backend and confirm `GET /api/v1/settings/nav-card` returns the default config.
- [ ] Update the config via `PUT /api/v1/settings/nav-card` and confirm the change persists.
- [ ] Run the frontend in mock mode (`USE_MOCK=true`):
  - Sidebar shows the new card in place of Help & Support.
  - Clicking the card opens the configured URL in a new tab.
  - A user with `platform_migration_lead` or `admin` role can open `/settings/nav-card`.
  - Changing title/description/URL and saving updates the sidebar card immediately without a full page reload.
  - The `/settings` home grid contains a "Custom Navigation Card" entry.
- [ ] Run existing tests: `cd frontend && npx playwright test e2e/tests/navigation.spec.ts e2e/tests/rbac.spec.ts` to ensure no regressions.
