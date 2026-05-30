# GBI (Global Business & Infrastructure) Feature Plan

## Context

Add a multi-tier organizational hierarchy called GBI to Migration Hub. GBI data is a tree with arbitrary depth (sample has 4 tiers, but actual data may vary). It must be:

1. **Maintained** via a dedicated settings page (`/settings/gbi`) with a tree component.
2. **Linked** to projects via a new `gbi_id` field — assignable **only** from the GBI maintenance screen.
3. **Secured** via a new role `gbi_cloud_lead` who can view projects at their assigned GBI tier or below.
4. **Administered** via a new admin page (`/admin/gbi-cloud-leads`) to create/manage `gbi_cloud_lead` users.

## ASCII Prototype Designs

### 1. Settings → GBI Hierarchy (`/settings/gbi`)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Settings  >  GBI Hierarchy                                                              │
│                                                                                          │
│  ┌─ GBI Hierarchy                                                   [ Import JSON ]    │
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
- Projects already linked to **this exact `gbi_id`** are checked; others are unchecked.
- Checking a project assigns its `gbi_id` to this node; unchecking clears it.
- This panel is the **only** place where `gbi_id` can be assigned or changed.

---

### 2. Project Details — GBI Field Display (`/projects/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Home  >  Projects  >  project-alpha                                                     │
│                                                                                          │
│  Project Alpha                                                       [status: planning]  │
│  No description provided.                                                                │
│                                                                                          │
│  ┌─ Metadata Strip ───────────────────────────────────────────────────────────────────┐  │
│  │  Wave: Wave-1    Story: MIG-42    ITSO: Alice    GBI: 1238 · CTO infrastructure   │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ... (existing sections: Application Overview, Risks, Resources, etc.)                   │
│
│  ┌─ Application Overview ──────────────────────────────────────────────────────────────┐ │
│  │  Application Name:  Project Alpha                                                    │ │
│  │  Short Name:         alpha                                                           │ │
│  │  BA ID:              BA-001                                                          │ │
│  │  GBI:                1238 — CTO infrastructure         [read-only, set in Settings]  │ │
│  │  ...                                                                                 │ │
│  └──────────────────────────────────────────────────────────────────────────────────────┘ │
```

**Behaviors:**
- `gbi_id` appears as a read-only field in the metadata strip and in Application Overview.
- It is **not editable** here — edit is gated to the GBI settings screen per requirements.

---

### 3. Admin → GBI Cloud Leads (`/admin/gbi-cloud-leads`)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Admin  >  GBI Cloud Leads                                                               │
│                                                                                          │
│  ┌─ GBI Cloud Lead Users                                              [ + Create User ]  │
│  │  Manage users who can view projects within a GBI subtree.                             │
│  │                                                                                       │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │  │ 🔍 Filter by name or email...                                                    │  │
│  │  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │  │ Name          │ Email              │ Assigned GBI            │ Actions           │  │
│  │  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │  │ Bob Smith     │ bob@company.com    │ 1235 — CTO              │ ✏️  🗑️           │  │
│  │  │ Carol Lee     │ carol@company.com  │ 1238 — CTO infrastructure │ ✏️  🗑️         │  │
│  │  │ Dave Wong     │ dave@company.com   │ —                       │ ✏️  🗑️           │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
│
│  Create / Edit Modal:
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐
│  │  Create GBI Cloud Lead User                                                           │
│  │                                                                                       │
│  │  Name *        [________________________]                                             │
│  │  Email *       [________________________]                                             │
│  │  Department *  [________________________]                                             │
│  │  Team          [________________________]                                             │
│  │                                                                                       │
│  │  Assigned GBI  [ Select GBI node ▼ ]                                                  │
│  │                └─ Dropdown tree: GCIO > CTO > CTO infrastructure > ...                │
│  │                                                                                       │
│  │  [Cancel]  [Create User]                                                              │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- Table lists all users whose role contains `gbi_cloud_lead`.
- Each row shows name, email, and the human-readable GBI node they are assigned to.
- The "Assigned GBI" dropdown in the modal uses the same tree component as the settings page.
- On create, the user is created (or reused by email) and their `role` field is set to `gbi_cloud_lead`.
- The assigned `gbi_id` is stored on the user record in a new column `gbi_id`.

---

### 4. Navigation Changes

**SettingsHome card grid** adds:
```
┌─────────────────────────────┐
│ 🏢 GBI Hierarchy            │
│ Manage the org structure    │
│ and link projects to tiers. │
└─────────────────────────────┘
```

**AdminHome card grid** adds:
```
┌─────────────────────────────┐
│ 👤 GBI Cloud Leads          │
│ Create and assign GBI cloud │
│ lead users to org tiers.    │
└─────────────────────────────┘
```

**AppSidebar** updates:
- `gbi_cloud_lead` users see: **Dashboard**, **Projects**, **Wave Gantt**.
- They do **not** see Engagements, Waves, Finance, Email, Templates, Settings, or Admin.
- The existing **Projects** (`/projects`) and **Wave Gantt** (`/waves/gantt`) pages are reused; only the data is filtered.

---

### 5. Projects List / Dashboard / Wave Gantt (for `gbi_cloud_lead` user)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                                               │
│                                                                                          │
│  ┌─ Projects                                                       [Wave Gantt]        │
│  │  Showing 12 projects (filtered by GBI: CTO and below)                                 │
│  │                                                                                       │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │  │ Name            │ Status    │ Wave    │ GBI                  │ Progress         │  │
│  │  ├─────────────────────────────────────────────────────────────────────────────────┤  │
│  │  │ Alpha App       │ planning  │ Wave-1  │ 1241 Cloud Service   │ ████████░░ 80%   │  │
│  │  │ Beta App        │ in-prog   │ Wave-2  │ 1242 Networking      │ ████░░░░░░ 40%   │  │
│  │  │ Gamma App       │ signed-off│ Wave-1  │ 1239 CTO Platform    │ ██████████ 100%  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- `gbi_cloud_lead` users navigate to the **same** `/projects` and `/waves/gantt` pages that Platform Migration Leads use.
- The backend automatically filters the project list to only those whose `gbi_id` matches the user's assigned `gbi_id` **or any of its descendants**.
- Dashboard stats (e.g. overall progress, counts) are also scoped to the GBI subtree.
- They can click into Project Details and view everything; write permissions follow existing project-member rules (no extra restrictions, no extra powers).

## Questions for You

1. **Project `gbi_id` storage**: Should `gbi_id` be a new top-level DB column on `projects` (cleaner for filtering / indexing), or nested inside `application_overview` JSONB?
2. **GBI assignment rules**: Can a project be linked to **only one** GBI node at a time? Should reassigning from node A to node B be allowed freely in the GBI settings panel?
3. **GBI data editing**: Should the GBI settings page support full CRUD (add/edit/delete/reorder nodes), or is import-only + assignment sufficient for MVP?

## Approach (pending your answers)

### Backend

- **New model** `GbiNode` (optional — if we want to store GBI in DB) OR load `gbi.json` into `ConfigStore` keyed by `gbi_hierarchy`.
- **New column** `gbi_id` on `User` (for `gbi_cloud_lead` assignment) and on `Project` (for project linking).
- **New router** `gbi.py`:
  - `GET /gbi` — return hierarchy tree.
  - `PUT /gbi` — replace hierarchy (admin only).
  - `GET /gbi/projects?gbi_id=xxx` — list projects linked to a GBI node.
  - `POST /gbi/assign-projects` — bulk assign / unassign `gbi_id` to projects.
- **New router** `gbi_cloud_leads.py` under `/admin`:
  - `GET /admin/gbi-cloud-leads` — list users with role `gbi_cloud_lead`.
  - `POST /admin/gbi-cloud-leads` — create user + set role and `gbi_id`.
  - `PATCH /admin/gbi-cloud-leads/{id}` — update assignment.
  - `DELETE /admin/gbi-cloud-leads/{id}` — remove role or delete user.
- **Auth changes**:
  - New dependency `require_gbi_cloud_lead`.
  - Project list filtering: if user has `gbi_cloud_lead`, intersect result set with subtree-matching `gbi_id`s.

### Frontend

- **New page** `GbiSettingsPage.tsx` (`/settings/gbi`) with a recursive `GbiTree` component.
- **New page** `GbiCloudLeadsPage.tsx` (`/admin/gbi-cloud-leads`).
- **Update** `SettingsHome.tsx` and `AdminHome.tsx` with new cards.
- **Update** `App.tsx` with new routes.
- **Update** `AppSidebar.tsx` — show **Dashboard**, **Projects**, **Wave Gantt** for `gbi_cloud_lead`; hide all other PML-only items.
- **Update** `ProjectDetailsPage.tsx` and `ApplicationOverviewSection.tsx` to display `gbi_id` read-only.
- **Update** `ProjectsPage.tsx` and home dashboard to implicitly filter by GBI subtree when the current user has `gbi_cloud_lead`.
- **New service** `gbi.ts` for API calls.
- **New types** for `GbiNode`, `GbiCloudLeadUser`.

## Files to Modify

### Backend
- `backend/app/models/project.py` — add `gbi_id` column
- `backend/app/models/user.py` — add `gbi_id` column
- `backend/app/schemas/project.py` — add `gbi_id` to relevant DTOs
- `backend/app/schemas/user.py` — add `gbi_id` to `UserOut`, `UserAdminUpdate`, new `GbiCloudLeadCreate`
- `backend/app/routers/projects.py` — include `gbi_id` in list/detail serializers, filter support
- `backend/app/routers/admin.py` — add GBI cloud lead endpoints
- `backend/app/auth.py` — add `gbi_cloud_lead` role checks
- `backend/app/main.py` — register new `gbi` router
- `backend/app/services/project_service.py` — filter by GBI subtree

### Frontend
- `frontend/src/App.tsx` — add routes `/settings/gbi`, `/admin/gbi-cloud-leads`
- `frontend/src/pages/SettingsHome.tsx` — add GBI card
- `frontend/src/pages/AdminHome.tsx` — add GBI Cloud Leads card
- `frontend/src/pages/SettingsPage.tsx` — keep PML-only (GBI settings editing stays restricted to PML)
- `frontend/src/components/layout/AppSidebar.tsx` — nav items for `gbi_cloud_lead`
- `frontend/src/pages/ProjectDetailsPage.tsx` — show `gbi_id` in metadata
- `frontend/src/components/project/ApplicationOverviewSection.tsx` — show `gbi_id` read-only
- `frontend/src/pages/ProjectsPage.tsx` — filter by GBI when `gbi_cloud_lead`
- `frontend/src/types/index.ts` — add `gbi_id?: string` to `Project`
- **New files**:
  - `frontend/src/pages/GbiSettingsPage.tsx`
  - `frontend/src/pages/GbiCloudLeadsPage.tsx`
  - `frontend/src/components/gbi/GbiTree.tsx`
  - `frontend/src/services/gbi.ts`

## Reuse

- **ConfigStore pattern** (`backend/app/models/config_store.py`, `migration_settings_service.py`) for persisting GBI JSON if we choose DB storage over static file.
- **Tree rendering** — no existing tree component; we will build a recursive `<GbiTreeNode>` using existing `@/components/ui/collapsible` or simple state + ` ChevronRight / ChevronDown`.
- **Admin table patterns** from `UserAccountsPage.tsx` (pagination, filtering, dialog modals, breadcrumb).
- **Settings page patterns** from `MigrationSettingsPage.tsx` (breadcrumb, save toast, card layout).
- **Project list filtering** already supports `userId` query param; extend to support `gbiId` or implicit filtering server-side.

## Steps

- [ ] 1. Get your answers to the questions above.
- [ ] 2. Finalize DB schema (columns + migration).
- [ ] 3. Implement backend: GBI router, project `gbi_id`, user `gbi_id`, auth rules.
- [ ] 4. Implement backend: admin GBI cloud lead CRUD.
- [ ] 5. Implement frontend: `GbiTree` component and `/settings/gbi` page.
- [ ] 6. Implement frontend: `/admin/gbi-cloud-leads` page.
- [ ] 7. Integrate `gbi_id` display into Project Details and Projects list.
- [ ] 8. Add navigation cards and routing.
- [ ] 9. Add permission gating for `gbi_cloud_lead` users (sidebar nav + API filtering).
- [ ] 10. End-to-end verification.

## Verification

- Upload `gbi.json` in settings; tree renders with correct depth.
- Assign 2 projects to node `1238`; verify `gbi_id` saved.
- Open Project Details; `gbi_id` visible, not editable.
- Create a `gbi_cloud_lead` user assigned to `1235`; login as that user.
- Confirm user sees only projects under `1235` subtree.
- Confirm full admin / PML users still see all projects.
