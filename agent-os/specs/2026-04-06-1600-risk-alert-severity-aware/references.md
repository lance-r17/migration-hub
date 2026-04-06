# References for Risk Alert Severity-Aware Naming

## Similar Implementations

### Email template variable system

- **Location:** `frontend/src/types/email.ts` — `TEMPLATE_VARIABLES`, `EMAIL_EVENT_LABELS`, `EmailEventType`
- **Relevance:** Defines the full set of available template variables and event type labels used across the builder UI and preview
- **Key patterns:** Adding a new variable follows the `{ key, label, category, example }` shape; event type keys must match the `EmailEventType` union

### Predefined templates

- **Location:** `frontend/src/data/emailTemplates.ts`
- **Relevance:** All 8 predefined templates are defined here with their rows, subject, and metadata
- **Key patterns:** Helper functions (`fullRow`, `twoColRow`, `textComponent`, etc.) assemble rows; template variables use `{{key}}` syntax

### Preview sample data

- **Location:** `frontend/src/pages/EmailPreviewPage.tsx` — `SAMPLE_DATA_SETS`
- **Relevance:** Each data set maps template variable keys to resolved example values used for preview rendering
- **Key patterns:** Add new variable keys alongside related ones; use realistic values

### Template card badge

- **Location:** `frontend/src/components/email-builder/TemplateCard.tsx` — `EVENT_COLORS`
- **Relevance:** Maps event type keys to Tailwind colour classes for the badge shown on each template card
- **Key patterns:** Key must match the `EmailEventType` string value exactly
