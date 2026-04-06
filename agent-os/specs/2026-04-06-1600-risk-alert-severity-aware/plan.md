# Risk Alert Email Template — Severity-Aware Naming

## Context

The existing "Critical Risk Alert" email template hardcoded "Critical" throughout its name, event type, subject, and body. Risks have three severity levels (`critical`, `medium`, `low`), so the template now dynamically reflects the actual severity of the triggering risk item.

## Changes

### `frontend/src/types/email.ts`
- `EmailEventType`: `'risk_alert_critical'` → `'risk_alert'`
- `EMAIL_EVENT_LABELS`: key/value updated to `risk_alert: 'Risk Alert'`
- `TEMPLATE_VARIABLES`: new entry `risk.severityLabel` (capitalised display form)

### `frontend/src/components/email-builder/TemplateCard.tsx`
- `EVENT_COLORS`: key renamed `risk_alert_critical` → `risk_alert` (colour unchanged)

### `frontend/src/data/emailTemplates.ts`
- `eventType`: `'risk_alert_critical'` → `'risk_alert'`
- `name`: `'Critical Risk Alert'` → `'Risk Alert'`
- `description`: severity-agnostic wording
- `subject`: `'⚠ {{risk.severityLabel}} Risk Alert: {{risk.title}} in {{project.name}}'`
- H2 heading: `'⚠ {{risk.severityLabel}} Risk Identified'`
- Body text: `'A {{risk.severity}} risk has been raised…'`

### `frontend/src/pages/EmailPreviewPage.tsx`
- All three `SAMPLE_DATA_SETS` entries: added `'risk.severityLabel'` with matching capitalised value
