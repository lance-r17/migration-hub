# References for Backend Modeling & API Service

## Similar Implementations

### Existing API service layer (frontend)

- **Location:** `frontend/src/services/`
- **Relevance:** Defines the exact HTTP endpoints, methods, and payload shapes the backend must implement
- **Key patterns:**
  - `client.ts` — `USE_MOCK` toggle; `apiClient.get/post/patch/put/delete` wrappers
  - Each service file exports a `ENDPOINTS` constant object with all paths for that domain
  - All service functions are `async` and return typed responses

### In-memory store (frontend)

- **Location:** `frontend/src/data/store.ts`
- **Relevance:** Business logic reference — every store function maps directly to a backend service function
- **Key patterns:**
  - `getProject(id)`, `updateProject(id, key, value)` → `project_service.get_project`, `project_service.update_project`
  - `appendAuditEntry()` called as a side-effect of every write → `audit_service.append_entry` called within same transaction

### Mock data

- **Location:** `frontend/src/data/mock.ts`
- **Relevance:** Source of truth for seed JSON — 1158 lines of TypeScript mock data
- **Key exports:** `mockUsers`, `mockProjects`, `mockWaves`, `mockProjectUsers`, `mockAuditEntries`, `mockWaves`, `mockSurveyConfig`, `mockResourceSurveyConfig`, `mockBillingExisting`, `mockBillingTarget`, `mockEmbargos`

### TypeScript type definitions

- **Location:** `frontend/src/types/index.ts`, `frontend/src/types/wave.ts`, `frontend/src/types/audit.ts`
- **Relevance:** Canonical type shapes → Pydantic schema shapes
- **Key types:** `Project`, `CloudResource`, `User`, `Wave`, `JiraSubtaskConfig`, `AuditLogEntry`, `AuditActor`, `AuditChange`, `EmbargoRecord`, `BillingRecord`, `BillingThresholdConfig`

### Jira job mock logic

- **Location:** `frontend/src/services/jiraJobs.ts`
- **Relevance:** Contains the full async job flow (pending → processing → completed) with key generation logic that must be replicated in `jira_service.process_jira_job()`
- **Key note:** This service bypasses `apiClient` entirely — it calls `store` directly. Frontend won't use `/api/v1/jira/jobs` until `jiraJobs.ts` is refactored

### Survey service

- **Location:** `frontend/src/services/surveyService.ts`
- **Relevance:** Uses `/api/v1/settings/` prefix (not `/api/v1/survey/`); also exposes `POST /api/v1/projects/{id}/resources/specs` for batch resource spec updates
