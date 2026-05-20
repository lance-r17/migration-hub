# MCP Service Design Plan — Migration Hub

## Context

Migration Hub is a FastAPI-backed cloud migration coordination platform. We want to expose its data and planning capabilities via the **Model Context Protocol (MCP)** so external AI agents can perform deep analysis, wave planning, and scheduling assistance.

## Current State (Backend Capabilities)

| Domain | Key Models | Relevant Services |
|--------|-----------|-------------------|
| Projects | `Project` (JSONB sections + relations) | `project_service.py` |
| Waves | `Wave` (dates, status, project_order) | `wave_service.py` |
| Resources | `CloudResource` (specs, migration flags) | `project_service.py` |
| Risks | `Risk` (severity, status, mitigation) | `project_service.py` |
| Approvals | `Approval` (sign-off workflow) | `signoff_service.py` |
| Embargos | `EmbargoRecord` (freeze windows) | `embargo_service.py` |
| Migration Settings | `ConfigStore` (platform periods) | `migration_settings_service.py` |
| Dashboard | `AuditLogEntry`, aggregate stats | `dashboard_service.py` |
| Jira Integration | `JiraJob`, `JiraJobLog` | `jira_service.py`, `jira_client.py` |
| Users | `User`, `ProjectUser` | `user_service.py` |
| Billing | `BillingRecord`, thresholds | `billing_service.py` |

**Auth modes already supported:** API Key (`X-API-Key`), Backend JWT (OAuth), OIDC JWT, Mock dev mode.

**Tech stack:** Python 3.12, FastAPI (async), SQLAlchemy 2.0 + asyncpg, PostgreSQL 16.

## Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Transport** | SSE only | Backend is already a web service; SSE mounts cleanly into FastAPI and reuses auth/CORS/ops stack. stdio can be added later as a thin wrapper if needed. |
| **Phase 1 scope** | Read-only | Agents analyze, recommend, and report. No mutations to projects, waves, or planning data in Phase 1. |
| **Deployment** | Embedded in FastAPI | New `/mcp/sse` endpoint inside existing app. Reuses `get_db`, `get_current_user`, connection pooling, logging, health checks, and k8s manifests. |

## Agent Skill Domains & Use Cases

Based on the Migration Hub data model, here are the high-value analysis skills an AI agent can provide:

### 1. Wave Readiness & Health Scoring
**What:** Compute a composite readiness score per wave/project based on survey completion, sign-off status, resource sync state, risk profile, and dependency satisfaction.  
**Value:** Platform leads get an at-a-glance view of which waves are actually ready to execute vs. which are blocked by incomplete surveys, missing approvals, or unresolved risks.

### 2. Dependency-Aware Scheduling Analysis
**What:** Map upstream/downstream project dependencies, detect cycles, and flag projects scheduled before their dependencies are complete.  
**Value:** Prevents cascading migration failures where a downstream app is cut over before its upstream dependency is stable.

### 3. Embargo & Constraint Conflict Detection
**What:** Cross-reference wave cutover dates and project `migrationConstraints` (earliest start, latest end, preferred windows) against `embargo_records` and platform migration periods.  
**Value:** Catches scheduling conflicts early — e.g., a wave cutover landing inside a change freeze, or a project's latest-end date exceeding the wave's cutover.

### 4. Resource Load & Capacity Planning
**What:** Aggregate resource counts by product category per wave, compare against historical throughput or team capacity, and flag overloaded waves.  
**Value:** Prevents waves from being bloated with too many resources, which stretches the migration team and increases failure risk.

### 5. Critical Path & Bottleneck Identification
**What:** Within a wave, identify which projects are on the critical path (blocking the most downstream work) and which are stuck in approval bottlenecks.  
**Value:** Platform leads can prioritize unblocking critical-path projects rather than spreading attention evenly.

### 6. Risk-Adjusted Timeline Forecasting
**What:** Factor open risks (severity, mitigation status) into projected completion dates. High-severity unmitigated risks = longer buffers suggested.  
**Value:** More realistic timeline estimates than raw date arithmetic.

### 7. Optimal Wave Assignment Recommendations
**What:** For unassigned projects, suggest wave placement based on constraint compatibility, dependency clustering, resource type affinity, and team membership.  
**Value:** Reduces manual trial-and-error in wave planning.

### 8. Cross-Wave Impact Analysis
**What:** If a project's dates or wave assignment changes, surface all affected downstream projects, waves, and Jira epics.  
**Value:** Prevents silent ripple effects across the migration program.

### 9. Jira Execution Readiness
**What:** Report on Jira job status per project (pending/processing/completed/failed), story/subtask coverage, and identify projects ready for sign-off-triggered Jira creation.  
**Value:** Ensures the Jira backlog accurately reflects the migration plan before execution starts.

## Proposed Tool Inventory (Phase 1 — Read-Only)

Each tool maps to existing service-layer functions where possible. Descriptions are phrased for LLM consumption (clear, actionable, with parameter semantics).

### Discovery & Search

| # | Tool | Input | Output | Reuses |
|---|------|-------|--------|--------|
| 1 | `search_projects` | `status?`, `wave_id?`, `min_progress?`, `has_unsynced_resources?`, `ba_id?`, `limit?` | List of `ProjectListItem` | `project_service.get_all` |
| 2 | `get_project_detail` | `project_id` | `ProjectDetail` + computed `stageProgress` | `project_service.get_by_id` |
| 3 | `list_waves` | — | List of `WaveOut` with `project_count` | `wave_service.get_all` |
| 4 | `get_wave_detail` | `wave_id` | `WaveOut` + ordered `ProjectListItem[]` + readiness summary | `wave_service.get_by_id` + `project_service.get_all` |
| 5 | `list_embargos` | `active_after?`, `affected_service_line?` | `EmbargoOut[]` | `embargo_service.get_all` |
| 6 | `list_users` | `project_id?` | `User[]` or project-scoped `ProjectUser[]` | `user_service` |

### Analysis & Planning

| # | Tool | Input | Output | Reuses / Notes |
|---|------|-------|--------|----------------|
| 7 | `analyze_wave_readiness` | `wave_id` | Readiness breakdown per project: `survey_complete`, `signoff_complete`, `resources_synced_pct`, `open_risk_count`, `blocking_reasons[]` | `project_service.compute_stage_progress` + risk/approval/resource aggregates |
| 8 | `suggest_wave_assignments` | `project_ids[]` or `unassigned_only?` | Suggested `wave_id` per project with rationale (constraint fit, dependency cluster, resource affinity) | Queries all waves + unassigned projects; pure analysis — no DB writes |
| 9 | `check_scheduling_conflicts` | `wave_id?`, `project_id?` | Conflicts: `embargo_overlap[]`, `date_constraint_violations[]`, `dependency_date_gaps[]` | `embargo_service.get_all` + wave/project constraint fields |
| 10 | `analyze_dependency_graph` | `project_id?`, `wave_id?` | Nodes (projects) + edges (up/downstream) + `cycles[]` + `orphan_nodes[]` | `project.dependencies` JSONB |
| 11 | `compute_resource_migration_progress` | `wave_id?`, `project_id?` | Total resources, in-scope, synced, completed, by product category | `CloudResource` aggregates via `project_service` |
| 12 | `analyze_risk_exposure` | `wave_id?`, `project_id?`, `min_severity?` | Open risks grouped by severity, with mitigation coverage and owner gaps | `Risk` model aggregates |
| 13 | `identify_approval_bottlenecks` | `wave_id?` | Projects stalled at each approval stage (`technical_lead`, `business_owner`, `platform_migration_lead`) | `Approval` model aggregates |

### Dashboard & Reporting

| # | Tool | Input | Output | Reuses |
|---|------|-------|--------|--------|
| 14 | `get_overall_stats` | — | `OverallStatsOut` | `dashboard_service.compute_stats` |
| 15 | `get_recent_activity` | `limit?` (default 50) | `ActivityOut[]` | `dashboard_service.get_recent_activity` |
| 16 | `get_risk_register` | `wave_id?`, `severity?`, `status?` | Flattened risk list with project + wave context | `Risk` + `Project` join |
| 17 | `get_jira_execution_status` | `project_id?`, `wave_id?` | Jira story/subtask keys, job status, completion rate | `jira_service.get_job` + `project.jira_story_key` |
| 18 | `get_migration_settings` | — | Platform period, cloud setup period, duration options | `migration_settings_service.get_migration_settings` |

### Jira & Execution (Phase 2 — Write)

| # | Tool | Input | Output | Notes |
|---|------|-------|--------|-------|
| 19 | `trigger_jira_job` | `project_id`, `config` | `JiraJobOut` | Queues background job; requires admin/API-key |
| 20 | `update_wave_project_order` | `wave_id`, `project_order[]` | `WaveOut` | Reorders projects within a wave |
| 21 | `update_project_planning` | `project_id`, `planning` | `ProjectDetail` | Updates Gantt milestones |
| 22 | `assign_project_to_wave` | `project_id`, `wave_id` | `ProjectDetail` | Moves project between waves |

> **Phase 2 tools are listed for completeness but out of scope for Phase 1 implementation.**

## Reuse Targets

| Reuse Source | What to Reuse |
|-------------|---------------|
| `backend/app/services/*_service.py` | All query/aggregation logic (read-only tools should call these, not raw SQL) |
| `backend/app/auth.py` | `_verify_api_key` and `get_current_user` for MCP request auth |
| `backend/app/database.py` | `AsyncSessionLocal`, `get_db` for DB sessions |
| `backend/app/schemas/*.py` | Pydantic models for tool input/output schemas |
| `backend/app/config.py` | `settings` for environment-driven behavior |

## K8s Deployment Pattern

The MCP SSE endpoint is **embedded in the existing FastAPI application** and therefore runs inside the same container as the REST API. No new Deployment, Service, or container image is required.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Ingress (Higress)                                          │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │ /api/*      │  │ /mcp/sse                             │  │
│  │   REST API  │  │   SSE stream (long-lived)            │  │
│  └──────┬──────┘  └──────────────┬───────────────────────┘  │
│         │                        │                           │
│         └────────────┬───────────┘                           │
│                      ▼                                       │
│  ┌──────────────────────────────────────────────┐           │
│  │  backend-api Deployment (replicas: 2–5)      │           │
│  │  ┌────────────────────────────────────────┐   │           │
│  │  │  Container: migration-hub-backend      │   │           │
│  │  │  Port: 8000                            │   │           │
│  │  │  DISABLE_BACKGROUND_TASKS: true        │   │           │
│  │  │  ┌─────────────┐  ┌─────────────────┐  │   │           │
│  │  │  │ FastAPI     │  │ MCP Server      │  │   │           │
│  │  │  │ /api/v1/*   │  │ /mcp/sse        │  │   │           │
│  │  │  └─────────────┘  └─────────────────┘  │   │           │
│  │  └────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Why no separate MCP deployment?

| Aspect | Rationale |
|--------|-----------|
| **Same image** | MCP is a Python module inside the existing FastAPI app; no new build artifact. |
| **Same DB pool** | Reuses `AsyncSessionLocal` and connection pooling already configured for the API. |
| **Same auth** | Reuses `X-API-Key` / Bearer token validation; no additional secrets or IAM roles. |
| **Same ops** | Existing HPA, PDB, liveness/readiness probes, and logging apply automatically. |
| **No background tasks** | MCP tools are synchronous request/response handlers; they do not need the worker pod's background monitors. |

### Ingress considerations for SSE

SSE connections are long-lived (persistent HTTP). The existing Higress ingress must be verified/configured for:

1. **Idle timeout** — Must be long enough (or disabled) for SSE streams. Default Envoy idle timeouts (often 300s) may drop idle connections. Higress should be configured via `RequestTimeout` or `IdleTimeout` CRDs if the default is too aggressive.
2. **No buffering** — The gateway must not buffer the response body; SSE requires immediate flush of each event.
3. **Connection limits** — If agent adoption is high, connection counts may exceed typical REST API levels. Monitor `backend-api` pod connection counts.

### Files to modify for K8s

| Path | Action | Purpose |
|------|--------|---------|
| `k8s/base/ingress.yaml` | Modify (comment/docs) | Document that `/mcp/sse` is routed through the same `backend-api` service; note SSE timeout considerations for Higress operators |
| `k8s/overlays/production/` | Review | Ensure production HPA `maxReplicas` accounts for potential increase in concurrent long-lived SSE connections |
| `k8s/base/backend-api.yaml` | No change | Existing Deployment/Service/HPA/PDB are sufficient |
| `k8s/base/kustomization.yaml` | No change | No new resources needed |

### Scaling considerations

- **Phase 1 (read-only)** — SSE connections are lightweight (mostly DB queries + JSON serialization). The existing HPA (CPU 70%) should handle moderate agent load.
- **Future (write-capable Phase 2)** — If agents trigger Jira jobs or planning updates, request rates may spike. At that point, consider:
  - A separate `backend-mcp` Deployment with its own HPA if agent traffic dwarfs human API traffic.
  - Rate-limiting middleware on `/mcp/sse` to prevent abuse.

## Files to Modify / Create

| Path | Action | Purpose |
|------|--------|---------|
| `backend/pyproject.toml` | Modify | Add `mcp>=1.0` dependency |
| `backend/app/main.py` | Modify | Register `/mcp/sse` endpoint; wire MCP server lifespan into FastAPI lifespan |
| `backend/app/mcp/__init__.py` | Create | Package init |
| `backend/app/mcp/server.py` | Create | `create_mcp_server()` — instantiates `mcp.server.Server`, registers all tools, handles initialization/teardown |
| `backend/app/mcp/sse_router.py` | Create | FastAPI router with `/sse` GET endpoint; uses `mcp.server.sse.SseServerTransport` or custom SSE transport to bridge HTTP ↔ MCP server |
| `backend/app/mcp/auth.py` | Create | `mcp_get_current_user()` — validates `X-API-Key` or `Authorization: Bearer` from SSE connection headers; returns `User` or raises 401 |
| `backend/app/mcp/tools/__init__.py` | Create | Collects all tool modules and exposes `register_all_tools(server, db_session_factory)` |
| `backend/app/mcp/tools/discovery.py` | Create | Tools 1–6: `search_projects`, `get_project_detail`, `list_waves`, `get_wave_detail`, `list_embargos`, `list_users` |
| `backend/app/mcp/tools/analysis.py` | Create | Tools 7–13: readiness, suggestions, conflict detection, dependency graph, resource progress, risk exposure, approval bottlenecks |
| `backend/app/mcp/tools/dashboard.py` | Create | Tools 14–18: stats, activity, risk register, jira status, migration settings |
| `backend/app/mcp/tools/write.py` | Create | Stub file for Phase 2 write tools (prevents refactor later) |
| `backend/app/mcp/schemas.py` | Create | Pydantic models for tool argument validation (where MCP JSON schema generation needs help) |
| `docs/mcp-integration.md` | Create | Usage guide: how to connect an MCP client, auth requirements, available tools, example prompts |
| `backend/tests/mcp/` | Create | Unit + integration tests for MCP tools and SSE transport |
| `k8s/base/ingress.yaml` | Modify (docs/comment) | Add comment documenting `/mcp/sse` routing and SSE timeout considerations for Higress operators |
| `k8s/overlays/production/` | Review | Verify HPA `maxReplicas` and any Higress timeout CRDs for SSE compatibility |

## Implementation Steps

### Step 1: Bootstrap MCP dependency and server skeleton
- [ ] Add `mcp>=1.0` to `backend/pyproject.toml` and install.
- [ ] Create `backend/app/mcp/server.py` with `create_mcp_server()` returning an `mcp.server.Server` instance.
- [ ] Create `backend/app/mcp/sse_router.py` with a FastAPI router and `/sse` GET endpoint that initializes the SSE transport and connects it to the MCP server.
- [ ] Mount the router in `backend/app/main.py` at `/mcp` (so the SSE endpoint becomes `/mcp/sse`).
- [ ] Verify the server starts and `/mcp/sse` responds with an SSE stream (even if empty).

### Step 2: Wire authentication
- [ ] Create `backend/app/mcp/auth.py` that reads headers from the incoming HTTP request (via FastAPI `Request` dependency) and reuses `_verify_api_key` / `get_current_user` logic.
- [ ] Pass the authenticated `User` into the MCP server context so every tool handler can access it.
- [ ] Return HTTP 401 for missing/invalid credentials on SSE connection setup.

### Step 3: Implement Discovery tools
- [ ] Create `backend/app/mcp/tools/discovery.py`.
- [ ] Implement `search_projects`, `get_project_detail`, `list_waves`, `get_wave_detail`, `list_embargos`, `list_users`.
- [ ] Each tool handler receives `(args, ctx)` where `ctx` carries the authenticated user and an async DB session.
- [ ] Reuse existing service functions (`project_service.get_all`, `wave_service.get_all`, etc.) — no raw SQL.
- [ ] Add unit tests in `backend/tests/mcp/test_discovery.py`.

### Step 4: Implement Analysis tools
- [ ] Create `backend/app/mcp/tools/analysis.py`.
- [ ] Implement `analyze_wave_readiness` using `compute_stage_progress` + risk/approval aggregates.
- [ ] Implement `check_scheduling_conflicts` by comparing wave dates + project constraints against embargo records.
- [ ] Implement `analyze_dependency_graph` by parsing `project.dependencies` JSONB.
- [ ] Implement `compute_resource_migration_progress`, `analyze_risk_exposure`, `identify_approval_bottlenecks`.
- [ ] Implement `suggest_wave_assignments` as a pure analytical heuristic (constraint compatibility + dependency clustering + resource count balancing).
- [ ] Add unit tests in `backend/tests/mcp/test_analysis.py`.

### Step 5: Implement Dashboard tools
- [ ] Create `backend/app/mcp/tools/dashboard.py`.
- [ ] Implement `get_overall_stats`, `get_recent_activity`, `get_risk_register`, `get_jira_execution_status`, `get_migration_settings`.
- [ ] Add unit tests in `backend/tests/mcp/test_dashboard.py`.

### Step 6: Integration testing
- [ ] Write `backend/tests/mcp/test_sse_integration.py` that starts the full FastAPI app, connects an MCP client over SSE, and calls each tool end-to-end.
- [ ] Verify auth: unauthenticated SSE connection rejected; valid API key accepted.
- [ ] Verify tool discovery: client can list all registered tools.

### Step 7: Documentation
- [ ] Write `docs/mcp-integration.md` with:
  - How to connect (SSE URL, auth headers)
  - Complete tool catalog with descriptions and example arguments
  - Example agent prompts: "Analyze wave readiness for wave X", "Find scheduling conflicts", "Suggest wave assignments for unassigned projects"
- [ ] Update `docs/backend/api.md` with a note about the MCP endpoint.

### Step 8: Deployment preparation
- [ ] Ensure the new `/mcp/sse` route is included in CORS origins if needed.
- [ ] Verify k8s readiness/liveness probes still pass (no new port needed; SSE is on same port).
- [ ] Add a simple health/tool-discovery smoke test to CI.

## Verification Plan

| # | Test | How |
|---|------|-----|
| 1 | Unit tests | `pytest backend/tests/mcp/` — each tool tested with an in-memory async DB session |
| 2 | Auth integration | `curl` to `/mcp/sse` without auth → 401; with `X-API-Key` → 200 SSE stream |
| 3 | MCP client integration | Python `mcp` SDK client connects over SSE, lists tools, calls `get_overall_stats` |
| 4 | End-to-end agent simulation | Prompt an MCP-enabled LLM (Claude, GPT with MCP adapter) with: *"Which projects in Wave 3 are blocking readiness?"* and verify it chains `get_wave_detail` → `analyze_wave_readiness` → `get_project_detail` |
| 5 | Load / stability | Run 50 concurrent SSE connections for 5 minutes; verify no DB connection pool exhaustion |

---

*Plan finalized based on confirmed decisions: SSE transport, read-only Phase 1, embedded in FastAPI.*
