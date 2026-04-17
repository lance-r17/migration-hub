# Resource Survey Revamp — Plan

## Context

Replace all resource survey groups with product-specific per-resource questions covering RDS/PolarDB/DDS (database migration), r-kvstore/Redis (usage pattern), OSS (hot/cold), and SLS (purpose + downstream consumers). Two new capabilities are introduced: a `date` input type and conditional question visibility based on a sibling answer.

## Tasks

### Task 1: Save spec documentation ✓

### Task 2: Rename `kvstore` → `r-kvstore` across all files

- `backend/app/services/product_category_service.py`
- `frontend/src/data/mock.ts` (product map + 2 resources + mock survey config)
- `backend/scripts/seed_data/projects.json` (res-a24)

### Task 3: Extend frontend TypeScript types (`frontend/src/types/survey.ts`)

- Add `'date'` to `ResourceSurveyInputType`
- Add `condition?: { specsKey: string; value: string }` to `ResourceQuestionDef`
- Add `products?: string[]` to `ResourceQuestionGroup`

### Task 4: Update SurveyModal (`frontend/src/components/survey/SurveyModal.tsx`)

- `computeResourceSteps`: handle `group.products?: string[]` in resource-level matching
- `resourceStepCanAdvance`: skip required-check for questions hidden by unfulfilled condition
- `ResourceQuestionInput`: add `'date'` case using existing `Calendar` + `Popover` components
- Question render loop: filter questions by condition before mapping

### Task 5: Replace seed data (`backend/scripts/seed_data/resource_survey_config.json`)

Full replacement with 4 groups: database (rds/polardb/dds), r-kvstore, oss, sls.

## Verification

1. `python seed.py --force` from `backend/scripts/`
2. Open survey modal on a project with RDS/PolarDB/DDS resources — confirm per-resource steps
3. Set "Migration type" = "Incremental" → date fields appear; set to "Standard" → disappear
4. r-kvstore resource → usage pattern question only (no eviction policy)
5. OSS resource → hot/cold question
6. SLS resource → purpose + downstream consumer list
