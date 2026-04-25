# References for Fix: Approval Authority Sync

## Similar Implementations

### _sync_project_user_roles (before fix)
- **Location:** `backend/app/services/project_service.py` ~line 321
- **Relevance:** The function being fixed — previously only updated existing rows, now also inserts missing governance-role holders.

### sync_user_projects (before fix)
- **Location:** `backend/app/services/user_service.py` ~line 57
- **Relevance:** The function being fixed — previously deleted all project_users rows indiscriminately, now preserves non-'member' roles.

### _check_approval_authority
- **Location:** `backend/app/services/project_service.py` ~line 306
- **Relevance:** The function that fails with 400. Queries `ProjectUser(project_id, actor_id)` — needs a row to exist with the correct role.

### OAuth login flow
- **Location:** `backend/app/routers/oauth.py` `sso_exchange()` ~line 90
- **Relevance:** Calls `sync_user_projects` after AD group matching — this is where governance roles were being wiped.
