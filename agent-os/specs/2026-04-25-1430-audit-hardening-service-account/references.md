# References for Audit Hardening & Service Account

## Similar Implementations

### `_replace_approvals()` in `project_service.py`

- **Location:** `backend/app/services/project_service.py:437`
- **Relevance:** Pattern for emitting a single audit event after a relational-table replacement; used as template for `_replace_risks()` audit call
- **Key pattern:** `await audit_service.append_entry(..., event_type="approval_submitted", changes=[])`

### `_classify_resource_changes()` in `project_service.py`

- **Location:** `backend/app/services/project_service.py:150`
- **Relevance:** Returns 4-tuple; extended to 5-tuple to distinguish `added`/`removed`/`updated` without changing the broader logic
- **Key pattern:** Returns `(rid, entity_label, changes, is_sync_complete)` per resource; caller iterates and emits audit entries

### `get_current_user` in `auth.py`

- **Location:** `backend/app/auth.py:163`
- **Relevance:** Priority-based auth dependency; API key check added as priority 0 before the existing three modes
- **Key pattern:** Mode selection via `if settings.oauth_service_url: ... elif settings.oidc_issuer: ... else: mock`

### `require_admin` in `auth.py`

- **Location:** `backend/app/auth.py:245`
- **Relevance:** Used as dependency on all admin service account endpoints; checks `platform_migration_lead` or `admin` role
