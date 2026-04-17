# References — Resource Survey Revamp

## Similar Implementations

### App survey `date` input

- **Location:** `frontend/src/components/survey/SurveyModal.tsx` — `QuestionInput` component, `case 'date'` block (~lines 285–310)
- **Relevance:** The resource `date` input reuses the same `Calendar` + `Popover` + `format(d, 'yyyy-MM-dd')` pattern
- **Key patterns:** `Popover` with `Calendar mode="single"`, value stored as ISO date string

### `ResourceQuestionInput` component

- **Location:** `frontend/src/components/survey/SurveyModal.tsx` ~lines 319–418
- **Relevance:** New `date` case is added here

### `computeResourceSteps`

- **Location:** `frontend/src/components/survey/SurveyModal.tsx` ~lines 454–509
- **Relevance:** `products?: string[]` handling added to the resource-level product filter block (~line 482)

### Resource survey seed config

- **Location:** `backend/scripts/seed_data/resource_survey_config.json`
- **Auth:** Loaded by `seed.py --force`; stored in `config_store` table under key `resource_survey`
