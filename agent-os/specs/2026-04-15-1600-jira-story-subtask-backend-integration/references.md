# References for Jira Story/Subtask Backend Integration

## Similar Implementations

### jiraJobs.ts — frontend mock simulation
- **Location:** `frontend/src/services/jiraJobs.ts`
- **Relevance:** The file being refactored; shows how story/subtask keys are generated per mode (resource-level, category-level, product-level, custom)
- **Key patterns:** `setTimeout` for staged transitions; `store.updateProject()` to write back story key and subtask keys

### jira_service.py — backend job processing
- **Location:** `backend/app/services/jira_service.py`
- **Relevance:** `process_job()` is the BackgroundTask that mirrors the frontend simulation; `_complete_job()` generates mock keys
- **Key patterns:** `AsyncSessionLocal` for background DB sessions; fan-out subtask key generation per mode; writes `project.jira_story_key` and `cloud_resource.jira_subtask_key`

### jira_client.py — existing real Jira API call
- **Location:** `backend/app/services/jira_client.py`
- **Relevance:** Shows the httpx BasicAuth pattern and ADF description format used for epic creation; `create_story()` and `create_subtask()` will follow the same pattern with a `parent` field

### ProjectDetailsPage.tsx — approval submit handler
- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx`
- **Relevance:** `handleConfirmWithJira()` is where `createJiraJob()` is called; also contains the `useEffect` that fires the completion toast when `jiraJobStatus === 'completed'`

### waves.ts — fromApi/toApi mapper pattern
- **Location:** `frontend/src/services/waves.ts`
- **Relevance:** Standard snake_case → camelCase mapping pattern used across all services; `jiraJobs.ts` will follow the same convention
