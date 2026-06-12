# BGI (Global Business & Infrastructure) Feature Plan

## Context

Add a multi-tier organizational hierarchy called BGI to Migration Hub. BGI data is a tree with arbitrary depth (sample has 4 tiers, but actual data may vary). It must be:

1. **Maintained** via a dedicated settings page (`/settings/bgi`) with a tree component.
2. **Linked** to projects via a new `bgi_id` field — assignable **only** from the BGI maintenance screen.
3. **Secured** via a new role `bgi_cloud_lead` who can view projects at their assigned BGI tier or below.
4. **Administered** via a new admin page (`/admin/bgi-cloud-leads`) to create/manage `bgi_cloud_lead` users.

## ASCII Prototype Designs

### 1. Settings → BGI Hierarchy (`/settings/bgi`)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Settings  >  BGI Hierarchy                                                              │
│                                                                                          │
│  ┌─ BGI Hierarchy                                                   [ Import JSON ]    │
│  │  Manage the organizational structure. Projects can be linked to any tier.             │
│  │                                                                                       │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │
│  │  │  ▼ 1234  GCIO                                                            ✏️ 🗑️ │     │
│  │  │    ├─ ▼ 1235  CTO                                                        ✏️ 🗑️ │     │
│  │  │    │   ├─ ▼ 1238  CTO infrastructure                                    ✏️ 🗑️ │     │
│  │  │    │   │   ├─ ● 1241  Cloud Service                                    ✏️ 🗑️ │     │
│  │  │    │   │   └─ ● 1242  Networking                                       ✏️ 🗑️ │     │
│  │  │    │   ├─ ▼ 1239  CTO Platform                                         ✏️ 🗑️ │     │
│  │  │    │   │   └─ ● 1243  CAEP                                            ✏️ 🗑️ │     │
│  │  │    │   └─ ▼ 1240  CTO Data                                            ✏️ 🗑️ │     │
│  │  │    │       └─ ● 1244  Data Science                                    ✏️ 🗑️ │     │
│  │  │    ├─ ▼ 1236  Whole Sale                                              ✏️ 🗑️ │     │
│  │  │    │   └─ ● 1245  Core Banking                                        ✏️ 🗑️ │     │
│  │  │    └─ ▼ 1237  WPB                                                     ✏️ 🗑️ │     │
│  │  │        └─ ● 1246  IWPB Technology                                     ✏️ 🗑️ │     │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │
│  │                                                                                       │
│  │  [ + Add Root Node ]                                                                  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
│
│  When a tree node is selected (e.g. 1238 CTO Infrastructure):
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐
│  │  Node Details                              ┌─ Assigned Projects ──────────────────┐  │
│  │  ID:    1238                               │  🔍 Search projects...               │  │
│  │  Name:  CTO infrastructure                 │                                      │  │
│  │                                            │  ☑ Project Alpha          [Unassign] │  │
│  │  [Save]                                    │  ☑ Project Beta           [Unassign] │  │
│  │                                            │  ☐ Project Gamma          [Assign]   │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- Tree is collapsible/expandable (▲/▼ arrows).
- Each node shows `id` + `name` and inline edit / delete icons.
- Clicking a node selects it and opens the right-hand detail panel.
- Detail panel shows node metadata + a searchable project list.
- Projects already linked to **this exact `bgi_id`** are checked; others are unchecked.
- Checking a project assigns its `bgi_id` to this node; unchecking clears it.
- This panel is the **only** place where `bgi_id` can be assigned or changed.

---

### 2. Project Details — BGI Field Display (`/projects/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Home  >  Projects  >  project-alpha                                                     │
│                                                                                          │
│  Project Alpha                                                       [status: planning]  │
│  No description provided.                                                                │
│                                                                                          │
│  ┌─ Metadata Strip ───────────────────────────────────────────────────────────────────┐  │
│  │  Wave: Wave-1    Story: MIG-42    ITSO: Alice    BGI: 1238 · CTO infrastructure   │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ... (existing sections: Application Overview, Risks, Resources, etc.)                   │
│
│  ┌─ Application Overview ──────────────────────────────────────────────────────────────┐ │
│  │  Application Name:  Project Alpha                                                    │ │
│  │  Short Name:         alpha                                                           │ │
│  │  BA ID:              BA-001                                                          │ │
│  │  BGI:                1238 — CTO infrastructure         [read-only, set in Settings]  │ │
│  │  ...                                                                                 │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
```

**Behaviors:**
- `bgi_id` appears as a read-only field in the metadata strip and in Application Overview.
- It is **not editable** here — edit is gated to the BGI settings screen per requirements.

---

### 3. Admin → BGI Cloud Leads (`/admin/bgi-cloud-leads`)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Admin  >  BGI Cloud Leads                                                               │
│                                                                                          │
│  ┌─ BGI Cloud Lead Users                                              [ + Create User ]  │
│  │  Manage users who can view projects within a BGI subtree.                             │
│  │                                                                                       │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │  │ 🔍 Filter by name or email...                                                    │  │
│  │  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │  │ Name          │ Email              │ Assigned BGI            │ Actions           │  │
│  │  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │  │ Bob Smith     │ bob@company.com    │ 1235 — CTO              │ ✏️  🗑️           │  │
│  │  │ Carol Lee     │ carol@company.com  │ 1238 — CTO infrastructure │ ✏️  🗑️         │  │
│  │  │ Dave Wong     │ dave@company.com   │ —                       │ ✏️  🗑️           │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
│
│  Create / Edit Modal:
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐
│  │  Create BGI Cloud Lead User                                                           │
│  │                                                                                       │
│  │  Name *        [________________________]                                             │
│  │  Email *       [________________________]                                             │
│  │  Department *  [________________________]                                             │
│  │  Team          [________________________]                                             │
│  │                                                                                       │
│  │  Assigned BGI  [ Select BGI node ▼ ]                                                  │
│  │                └─ Dropdown tree: GCIO > CTO > CTO infrastructure > ...                │
│  │                                                                                       │
│  │  [Cancel]  [Create User]                                                              │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- Table lists all users whose role contains `bgi_cloud_lead`.
- Each row shows name, email, and the human-readable BGI node they are assigned to.
- The "Assigned BGI" dropdown in the modal uses the same tree component as the settings page.
- On create, the user is created (or reused by email) and their `role` field is set to `bgi_cloud_lead`.
- The assigned `bgi_id` is stored on the user record in a new column `bgi_id`.

---

### 4. Navigation Changes

**SettingsHome card grid** adds:
```
┌─────────────────────────────┐
│ 🏢 BGI Hierarchy            │
│ Manage the org structure    │
│ and link projects to tiers. │
└─────────────────────────────┘
```

**AdminHome card grid** adds:
```
┌─────────────────────────────┐
│ 👤 BGI Cloud Leads          │
│ Create and assign BGI cloud │
│ lead users to org tiers.    │
└─────────────────────────────┘
```

**AppSidebar** updates:
- `bgi_cloud_lead` users see: **Dashboard**, **Projects**, **Wave Gantt**.
- They do **not** see Engagements, Waves, Finance, Email, Templates, Settings, or Admin.
- The existing **Projects** (`/projects`) and **Wave Gantt** (`/waves/gantt`) pages are reused; only the data is filtered.

---

### 5. Projects List / Dashboard / Wave Gantt (for `bgi_cloud_lead` user)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                                               │
│                                                                                          │
│  ┌─ Projects                                                       [Wave Gantt]        │
│  │  Showing 12 projects (filtered by BGI: CTO and below)                                 │
│  │                                                                                       │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │  │ Name            │ Status    │ Wave    │ BGI                  │ Progress         │  │
│  │  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │  │ Alpha App       │ planning  │ Wave-1  │ 1241 Cloud Service   │ ████████░░ 80%   │  │
│  │  │ Beta App        │ in-prog   │ Wave-2  │ 1242 Networking      │ ████░░░░░░ 40%   │  │
│  │  │ Gamma App       │ signed-off│ Wave-1  │ 1239 CTO Platform    │ ██████████ 100%  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- `bgi_cloud_lead` users navigate to the **same** `/projects` and `/waves/gantt` pages that Platform Migration Leads use.
- The backend automatically filters the project list to only those whose `bgi_id` matches the user's assigned `bgi_id` **or any of its descendants**.
- Dashboard stats (e.g. overall progress, counts) are also scoped to the BGI subtree.
- They can click into Project Details and view everything; write permissions follow existing project-member rules (no extra restrictions, no extra powers).

## Questions for You

1. **Project `bgi_id` storage**: Should `bgi_id` be a new top-level DB column on `projects` (cleaner for filtering / indexing), or nested inside `application_overview` JSONB?
2. **BGI assignment rules**: Can a project be linked to **only one** BGI node at a time? Should reassigning from node A to node B be allowed freely in the BGI settings panel?
3. **BGI data editing**: Should the BGI settings page support full CRUD (add/edit/delete/reorder nodes), or is import-only + assignment sufficient for MVP?

## Approach (pending your answers)

### Backend

- **New model** `BgiNode` (optional — if we want to store BGI in DB) OR load `bgi.json` into `ConfigStore` keyed by `bgi_hierarchy`.
- **New column** `bgi_id` on `User` (for `bgi_cloud_lead` assignment) and on `Project` (for project linking).
- **New router** `bgi.py`:
  - `GET /bgi` — return hierarchy tree.
  - `PUT /bgi` — replace hierarchy (admin only).
  - `GET /bgi/projects?bgi_id=xxx` — list projects linked to a BGI node.
  - `POST /bgi/assign-projects` — bulk assign / unassign `bgi_id` to projects.
- **New router** `bgi_cloud_leads.py` under `/admin`:
  - `GET /admin/bgi-cloud-leads` — list users with role `bgi_cloud_lead`.
  - `POST /admin/bgi-cloud-leads` — create user + set role and `bgi_id`.
  - `PATCH /admin/bgi-cloud-leads/{id}` — update assignment.
  - `DELETE /admin/bgi-cloud-leads/{id}` — remove role or delete user.
- **Auth changes**:
  - New dependency `require_bgi_cloud_lead`.
  - Project list filtering: if user has `bgi_cloud_lead`, intersect result set with subtree-matching `bgi_id`s.

### Frontend

- **New page** `BgiSettingsPage.tsx` (`/settings/bgi`) with a recursive `BgiTree` component.
- **New page** `BgiCloudLeadsPage.tsx` (`/admin/bgi-cloud-leads`).
- **Update** `SettingsHome.tsx` and `AdminHome.tsx` with new cards.
- **Update** `App.tsx` with new routes.
- **Update** `AppSidebar.tsx` — show **Dashboard**, **Projects**, **Wave Gantt** for `bgi_cloud_lead`; hide all other PML-only items.
- **Update** `ProjectDetailsPage.tsx` and `ApplicationOverviewSection.tsx` to display `bgi_id` read-only.
- **Update** `ProjectsPage.tsx` and home dashboard to implicitly filter by BGI subtree when the current user has `bgi_cloud_lead`.
- **New service** `bgi.ts` for API calls.
- **New types** for `BgiNode`, `BgiCloudLeadUser`.

## Files to Modify

### Backend
- `backend/app/models/project.py` — add `bgi_id` column
- `backend/app/models/user.py` — add `bgi_id` column
- `backend/app/schemas/project.py` — add `bgi_id` to relevant DTOs
- `backend/app/schemas/user.py` — add `bgi_id` to `UserOut`, `UserAdminUpdate`, new `BgiCloudLeadCreate`
- `backend/app/routers/projects.py` — include `bgi_id` in list/detail serializers, filter support
- `backend/app/routers/admin.py` — add BGI cloud lead endpoints
- `backend/app/auth.py` — add `bgi_cloud_lead` role checks
- `backend/app/main.py` — register new `bgi` router
- `backend/app/services/project_service.py` — filter by BGI subtree

### Frontend
- `frontend/src/App.tsx` — add routes `/settings/bgi`, `/admin/bgi-cloud-leads`
- `frontend/src/pages/SettingsHome.tsx` — add BGI card
- `frontend/src/pages/AdminHome.tsx` — add BGI Cloud Leads card
- `frontend/src/pages/SettingsPage.tsx` — keep PML-only (BGI settings editing stays restricted to PML)
- `frontend/src/components/layout/AppSidebar.tsx` — nav items for `bgi_cloud_lead`
- `frontend/src/pages/ProjectDetailsPage.tsx` — show `bgi_id` in metadata
- `frontend/src/components/project/ApplicationOverviewSection.tsx` — show `bgi_id` read-only
- `frontend/src/pages/ProjectsPage.tsx` — filter by BGI when `bgi_cloud_lead`
- `frontend/src/types/index.ts` — add `bgi_id?: string` to `Project`
- **New files**:
  - `frontend/src/pages/BgiSettingsPage.tsx`
  - `frontend/src/pages/BgiCloudLeadsPage.tsx`
  - `frontend/src/components/bgi/BgiTree.tsx`
  - `frontend/src/services/bgi.ts`

## Reuse

- **ConfigStore pattern** (`backend/app/models/config_store.py`, `migration_settings_service.py`) for persisting BGI JSON if we choose DB storage over static file.
- **Tree rendering** — no existing tree component; we will build a recursive `<BgiTreeNode>` using existing `@/components/ui/collapsible` or simple state + ` ChevronRight / ChevronDown`.
- **Admin table patterns** from `UserAccountsPage.tsx` (pagination, filtering, dialog modals, breadcrumb).
- **Settings page patterns** from `MigrationSettingsPage.tsx` (breadcrumb, save toast, card layout).
- **Project list filtering** already supports `userId` query param; extend to support `bgiId` or implicit filtering server-side.

## Steps

- [ ] 1. Get your answers to the questions above.
- [ ] 2. Finalize DB schema (columns + migration).
- [ ] 3. Implement backend: BGI router, project `bgi_id`, user `bgi_id`, auth rules.
- [ ] 4. Implement backend: admin BGI cloud lead CRUD.
- [ ] 5. Implement frontend: `BgiTree` component and `/settings/bgi` page.
- [ ] 6. Implement frontend: `/admin/bgi-cloud-leads` page.
- [ ] 7. Integrate `bgi_id` display into Project Details and Projects list.
- [ ] 8. Add navigation cards and routing.
- [ ] 9. Add permission gating for `bgi_cloud_lead` users (sidebar nav + API filtering).
- [ ] 10. End-to-end verification.

## Verification

- Upload `bgi.json` in settings; tree renders with correct depth.
- Assign 2 projects to node `1238`; verify `bgi_id` saved.
- Open Project Details; `bgi_id` visible, not editable.
- Create a `bgi_cloud_lead` user assigned to `1235`; login as that user.
- Confirm user sees only projects under `1235` subtree.
- Confirm full admin / PML users still see all projects.
