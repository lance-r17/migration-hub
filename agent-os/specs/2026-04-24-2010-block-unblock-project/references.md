# References for Block/Unblock Project

## Similar Implementations

### Section Update Endpoint

- **Location:** `backend/app/routers/projects.py` (`update_section`)
- **Relevance:** Existing PATCH endpoint for project sections. Will be extended with auth checks for status changes.
- **Key patterns:** Uses `SectionPatch` schema, delegates to `project_service.update_section()`.

### Direct Project Update Endpoint

- **Location:** `backend/app/routers/projects.py` (`update_project`)
- **Relevance:** Direct PATCH endpoint for project fields. Needs same auth check for completeness.
- **Key patterns:** Uses `ProjectPatch` schema, delegates to `project_service.update()`.

### Metadata Strip UI

- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx` (lines 373-433)
- **Relevance:** Where the Block/Unblock button will be placed.
- **Key patterns:** Conditional rendering based on `canSignOff`, `isPlatformLead`, and `preSignOffStatuses`.

### Role Check Pattern

- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx:293`, `backend/app/services/project_service.py:359-371`
- **Relevance:** Both frontend and backend already check for `platform_migration_lead` role.
- **Key patterns:** Frontend: `user?.role.includes('platform_migration_lead')`. Backend: `"platform_migration_lead" in (user.role or "")`.
