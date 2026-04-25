# References for Derive Project Status from Stage Progress

## Similar Implementations

### Backend Stage Progress Computation

- **Location:** `backend/app/services/project_service.py`
- **Relevance:** Contains `compute_stage_progress()` which calculates per-stage percentages. The new `derive_status_from_stage_progress()` will build on this.
- **Key patterns:** Pure function taking a `Project` model, computing setup/survey/signoff/migration percentages.

### API Response Builders

- **Location:** `backend/app/routers/projects.py`
- **Relevance:** `_project_list_item()` and `_project_detail()` inject `stage_progress` into responses. These should now derive `status` as well.
- **Key patterns:** Uses `compute_stage_progress()` then strips `overall` before returning.

### StatusBadge Component

- **Location:** `frontend/src/components/shared/StatusBadge.tsx`
- **Relevance:** Maps `ProjectStatus` to Badge variant + label. Will be enhanced with optional `stageProgress` prop and tooltip.
- **Key patterns:** Simple mapping table, uses shadcn/ui `Badge`.

### ProjectCard

- **Location:** `frontend/src/components/home/ProjectCard.tsx`
- **Relevance:** Shows `StatusBadge` and `ProgressBar`. Will pass `stageProgress` to enhanced `StatusBadge`.
- **Key patterns:** Tooltip already used for progress bar stage breakdown.

### ProjectDetailsPage

- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx`
- **Relevance:** Shows `StatusBadge` in header and `StageProgressStepper` below. Will pass `stageProgress` to enhanced `StatusBadge`.
- **Key patterns:** Stepper already computes stage details client-side.
