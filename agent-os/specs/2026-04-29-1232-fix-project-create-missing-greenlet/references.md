# References for Fix Project Creation API

## Similar Implementations

### `project_service.get_by_id()`

- **Location:** `backend/app/services/project_service.py`
- **Relevance:** Shows the correct eager-loading pattern using `_project_options()` with `selectinload` for all project relationships.
- **Key pattern:** `select(Project).where(Project.id == project_id).options(*_project_options())`

### `project_service.get_all()`

- **Location:** `backend/app/services/project_service.py`
- **Relevance:** Also eagerly loads relationships (`approvals`, `cloud_resources`, `wave`, `profile_owner_user`, `project_users`) to avoid lazy-loading issues in the router's sync helpers.
- **Key pattern:** Explicit `selectinload` options on the query.
