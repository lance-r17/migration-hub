# References for Multi-Role Support

## Similar Implementations

### fromApi/toApi mapper pattern

- **Location:** `frontend/src/services/projects.ts`, `frontend/src/services/billing.ts`, `frontend/src/services/embargos.ts`
- **Relevance:** Establishes the convention for transforming snake_case API responses and reshaping fields (like arrays) at the service boundary
- **Key patterns:** Each service file defines a local `fromApi(raw)` function applied to every API response before returning typed data to callers

### `_user_has_admin_role` (backend)

- **Location:** `backend/app/auth.py:237-242`
- **Relevance:** Shows the multi-role pattern already used server-side — splits on comma, checks intersection with admin set
- **Key patterns:** `{r.strip() for r in role.split(",") if r.strip()}` then `not user_roles.isdisjoint(_ADMIN_ROLES)`

### OAuth role assignment (backend)

- **Location:** `backend/app/routers/oauth.py:168-191`
- **Relevance:** Confirms how roles are built — AD groups matched against regex mappings, results joined with comma
