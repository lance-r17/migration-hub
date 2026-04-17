# References for Jira Issue Descriptions

## Key Files

### `backend/app/services/jira_client.py`
- **Relevance:** Defines `create_story`, `create_subtask`, `create_epic` — the Jira REST API wrappers
- **Key patterns:** ADF dict passed as `fields["description"]`; `create_epic` shows the existing pattern

### `backend/app/services/jira_service.py`
- **Relevance:** Orchestrates the job lifecycle (`_complete_job`, `_complete_operation_job`); where description builders are called
- **Key patterns:** Checkpoint-based commit pattern; `expire_on_commit=False` keeps ORM attributes live after commits

### `backend/app/models/project.py`
- **Relevance:** Project JSONB fields — `application_overview`, `migration_constraints`, `availability`, `dependencies`, `team`

### `backend/app/models/wave.py`
- **Relevance:** `name`, `start_date`, `cutover_date`

### `backend/app/models/risk.py`
- **Relevance:** `title`, `severity`, `risk_status` — used for Open Risks section

### `backend/app/models/cloud_resource.py`
- **Relevance:** `name`, `resource_id`, `target_resource_id`, `product`, `resource_set`, `sub_application`, `specs`, `jira_subtask_key`

### `backend/scripts/seed_data/projects.json`
- **Relevance:** Confirms exact JSONB field shapes:
  - `regularMigrationWindow` is a plain string (not a dict)
  - `preferredMigrationWindow` is `["weekend"]` or `["weekday", "weekend"]`
  - `changeFreezePeriods` items are `{name, from, to}` dicts
  - `dependencies.upstream/downstream` are arrays of `{id, name, eimId, ...}`
