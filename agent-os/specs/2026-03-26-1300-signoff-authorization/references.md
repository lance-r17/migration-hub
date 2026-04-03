# References for Sign-Off Authorization

### canSignOff logic
- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx` lines 162–169
- **Relevance:** The only place the sign-off button visibility is computed — minimal change here

### Approval placeholder userId pattern
- **Location:** `frontend/src/data/mock.ts` lines 84–88 (and other approval arrays)
- **Relevance:** All TL/BO approval entries use stale `u-tech-lead`/`u-biz-owner` IDs; replaced with real user IDs

### applicationOverview user IDs
- **Location:** `frontend/src/data/mock.ts` — each project's `applicationOverview.technicalLeadId` and `businessOwnerId`
- **Relevance:** Source of truth for who is authorized to sign off

### devPersonas
- **Location:** `frontend/src/data/mock.ts` — `devPersonas` export
- **Relevance:** Business Owner persona updated to Karen Lee (u12) for live sign-off testing
