# References for Software Origin Field

## Similar Implementations

### Application Profile Drawer

- **Location:** `frontend/src/components/drawers/ApplicationProfileDrawer.tsx`
- **Relevance:** Shows how to add a new select input to the Application Profile edit form.
- **Key patterns:** Use `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` from `@/components/ui/select`. Persist by converting empty string to `undefined`.

### Application Overview Section

- **Location:** `frontend/src/components/project/ApplicationOverviewSection.tsx`
- **Relevance:** Shows how to render a read-only badge for a field value.
- **Key patterns:** Use `YesNoBadge` for booleans, or a simple styled `span` for select values.

### Effort Table Editor

- **Location:** `frontend/src/components/project/EffortTableEditor.tsx`
- **Relevance:** Where the `thirdParty` default logic must be injected.
- **Key patterns:** `createEmptyTable()` returns `EffortTable` with predefined tasks. Add optional `softwareOrigin` prop and set `thirdParty` on each task at creation time.

### Survey Field Definitions

- **Location:** `frontend/src/data/surveyFields.ts` and `backend/app/data/survey_field_defs.py`
- **Relevance:** Must add matching `appoverview__softwareOrigin` entry to both.
- **Key patterns:** `inputType: 'select'`, `options: ['in-house', '3rd party']`, `sectionKey: 'applicationOverview'`.

### Email Template Variables

- **Location:** `frontend/src/types/email.ts`
- **Relevance:** Add `project.softwareOrigin` to `TEMPLATE_VARIABLES` so it appears in the email builder variable picker.
- **Key patterns:** Append to `TEMPLATE_VARIABLES` array with `category: 'Project'`.
