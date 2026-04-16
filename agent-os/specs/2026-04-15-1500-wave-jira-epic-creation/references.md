# References for Wave → Jira Epic Creation

## Similar Implementations

### jira_service.py — Jira job processing

- **Location:** `backend/app/services/jira_service.py`
- **Relevance:** Shows the existing Jira simulation pattern and how project/epic keys are generated
- **Key patterns:** `AsyncSessionLocal` usage, key generation format (`{project_key}-{num}`)

### auth.py — httpx async usage

- **Location:** `backend/app/auth.py`
- **Relevance:** Shows how httpx.AsyncClient is used in the backend for external HTTP calls

### waves.py router — wave creation endpoint

- **Location:** `backend/app/routers/waves.py`
- **Relevance:** The endpoint being modified; shows existing `jira_project_key` fallback pattern

### 2026-03-24-0000-wave-planning spec

- **Location:** `agent-os/specs/2026-03-24-0000-wave-planning/shape.md`
- **Relevance:** Defines the Jira hierarchy: Epic = Wave, Story = Project, Subtask = CloudResource
