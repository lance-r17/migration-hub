# HomePage Performance Tuning

## Context

The `HomePage.tsx` mount sequence fires **5 API requests** (`stats`, `activity`, `projects`, `waves`, `embargos`) and the payloads are significantly larger than what the UI actually renders. At ~300 projects with ~20 resources each, the project list JSON alone can balloon to **multiple megabytes** because every `cloud_resource` carries a `specs` blob and the backend loads all relations into memory. This causes slow initial load and unnecessary network I/O.

## Key Findings from Code Review

### 1. Frontend Over-Fetching
- `useProjects()` pulls the full `ProjectListItem` schema for every project.
- `useWaves()` and `useEmbargos()` fire for **all** users, but are only consumed when `isPlatformLead === true`.
- `useDashboard()` fires for all users, but `stats` is only shown to platform leads and `activity` is only rendered for platform leads.

### 2. Backend Payload Bloat (`ProjectListItem`)
The list endpoint (`GET /api/v1/projects`) returns, per project:
- `cloud_resources` — includes `specs: Record<string, unknown>` (large JSON blobs) that **HomePage never uses**.
- `approvals` — full approval arrays.
- `planning` — full Gantt task trees.
- `migration_constraints`, `migration_effort_estimation`, `application_overview` — heavy JSON sections.
- `team` — loaded via `selectinload(Project.project_users)`.

HomePage only needs a small subset:
- `ProjectCard`: `id`, `name`, `status`, `progress`, `stageProgress`, `team`, `updatedAt`, `blockedReason`, `currentInfrastructure.resources.length`, `migrationWave`, `migrationConstraints` (dates), `planning` (dates).
- `OverallProgressCard`: + `surveySubmittedAt`, `waveId`, `planning`, `migrationConstraints`.
- `ProjectStatusChartCard`: + `currentInfrastructure.resources[].product`, `surveySubmittedAt`.
- `SecurityHealthWidget` (computed in page): + `risks[]` (severity, riskStatus, title), `status`, `currentInfrastructure.resources[].product`, `currentInfrastructure.resources[].syncStatus`.

### 3. Backend Inefficient Stats Computation
- `dashboard_service.compute_stats()` calls `project_service.get_all(session)`, which eagerly loads **all projects + all relations** (`cloud_resources`, `approvals`, `wave`, `project_users`) just to compute an average progress in Python.
- `total_assets` also loads everything when a simple `COUNT(*)` on `cloud_resources` would suffice.

## Recommended Approach

A three-pronged optimization that keeps changes localized and avoids breaking other pages:

1. **Frontend: Skip irrelevant requests for non-platform-leads.**
2. **Backend: Add a dedicated `/projects/home` lightweight endpoint.**
3. **Backend: Fix `compute_stats` to avoid loading heavy relations.**

We will **not** consolidate into a single mega-endpoint because the existing parallel fetch pattern is fine once the payloads are small; a single endpoint would complicate caching and require larger refactoring.

## Files to Modify

### Frontend
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/hooks/use-dashboard.ts`
- `frontend/src/hooks/use-projects.ts`
- `frontend/src/hooks/use-waves.ts`
- `frontend/src/hooks/use-embargos.ts`
- `frontend/src/services/projects.ts`

### Backend
- `backend/app/routers/projects.py`
- `backend/app/services/dashboard_service.py`
- `backend/app/services/project_service.py`
- `backend/app/schemas/project.py`
- `backend/app/schemas/cloud_resource.py`
- `backend/app/schemas/risk.py`

## Reuse
- Existing `apiClient` and service layer pattern in `frontend/src/services/`.
- Existing `ProjectListItem` / `ProjectDetail` schema split in backend.
- Existing `selectinload` options in `project_service.get_all()`.

## Steps

### Step 1: Frontend — Conditional Data Fetching
- [ ] Modify `useWaves()` to accept `{ enabled?: boolean }` and skip the `useEffect` fetch when `enabled === false`.
- [ ] Modify `useEmbargos()` to accept `{ enabled?: boolean }` and skip the fetch when disabled.
- [ ] Modify `useDashboard()` to accept `{ enabled?: boolean }` and skip both `stats` and `activity` fetches when disabled.
- [ ] Update `HomePage.tsx` to pass `enabled: isPlatformLead` to `useWaves()`, `useEmbargos()`, and `useDashboard()`.
- [ ] Ensure `loading` state correctly reflects skipped hooks (return `loading: false` when disabled).

### Step 2: Backend — Lightweight Project Home Schema
- [ ] Create `CloudResourceHomeOut` in `backend/app/schemas/cloud_resource.py`:
  - Fields: `resource_id`, `name`, `product`, `sync_status`, `need_migration`, `migration_completed`
  - Excludes: `specs`, `resource_set`, `sub_application`, `target_resource_id`, `jira_subtask_key`, `project_id`
- [ ] Create `RiskHomeOut` in `backend/app/schemas/risk.py`:
  - Fields: `id`, `title`, `description`, `severity`, `risk_status`
  - Excludes: `mitigation`, `owner`, `project_id`
- [ ] Create `ProjectHomeItem` in `backend/app/schemas/project.py`:
  - Same as `ProjectListItem` but `cloud_resources: list[CloudResourceHomeOut]` and adds `risks: list[RiskHomeOut]`.
  - Keeps `approvals` (small, maintains TypeScript compatibility) but drops `migration_effort_estimation` and `application_overview` (unused on home).

### Step 3: Backend — Lightweight Home Endpoint
- [ ] Add `project_service.get_all_home(session, user_id)` that loads only required relations:
  - `selectinload(Project.cloud_resources)`
  - `selectinload(Project.risks)`
  - `selectinload(Project.approvals)` (needed for `progress` computation)
  - `selectinload(Project.project_users).selectinload(ProjectUser.user)` (needed for `team`)
  - Does **not** load `wave`.
- [ ] Add `_project_home_item(p)` helper in `backend/app/routers/projects.py` that:
  - Calls `compute_stage_progress(p)` for `progress` and `stage_progress`
  - Serializes using `CloudResourceHomeOut`, `RiskHomeOut`, and drops heavy fields
- [ ] Add `GET /api/v1/projects/home` endpoint in `backend/app/routers/projects.py`:
  - Accepts optional `userId` query param
  - Returns `list[ProjectHomeItem]`
  - Uses `get_all_home()`

### Step 4: Backend — Optimize Dashboard Stats
- [ ] Modify `dashboard_service.compute_stats()`:
  - Use SQL `func.count()` for `total_assets` (cloud_resources table).
  - Use SQL `func.count()` with `where` for `completed` and `in_progress` statuses.
  - For average `progress`, call a new `project_service.get_all_for_stats(session)` that loads **only** `cloud_resources` and `approvals` (no `wave`, no `project_users`, no `risks`).
  - Compute avg progress from `compute_stage_progress()` over the lightweight list.

### Step 5: Frontend — Use Home Endpoint
- [ ] Add `getProjectsHome()` and `getProjectsHomeForUser(userId)` to `frontend/src/services/projects.ts` calling `/api/v1/projects/home`.
- [ ] Update `useProjects()` to accept `options?: { home?: boolean }`.
  - When `home === true`, call the new home endpoints instead of the full list endpoints.
- [ ] Update `HomePage.tsx` to pass `{ home: true }` to `useProjects()`.
- [ ] Verify TypeScript compatibility: the new backend response is a strict subset of `Project[]` (all extra frontend fields are optional; required arrays `risks` and `approvals` are still returned).

### Step 6: Verification
- [ ] Run the frontend dev server and backend, navigate to HomePage as both platform lead and non-lead.
- [ ] Verify Network tab:
  - Non-lead: only 1 request (`/projects/home?userId=...`) instead of 5.
  - Lead: 5 requests but `/projects/home` payload is significantly smaller than `/projects`.
- [ ] Check that `SecurityHealthWidget`, `ProjectStatusChartCard`, `OverallProgressCard`, and `ActivityTimeline` all render correctly.
- [ ] Check that `ProjectsPage`, `WavesPage`, and `FinancePage` continue to work (they still use the full `/projects` endpoint).
