# Risk Alert — Severity-Aware Naming

## Scope

Update the "Critical Risk Alert" email template so it reflects the actual severity of the risk item rather than hardcoding "Critical" everywhere. Risks have three levels (`critical`, `medium`, `low`) and the email subject, heading, and body text should all use the severity from the triggering risk.

## Decisions

- Rename the event type from `risk_alert_critical` → `risk_alert` to remove the severity assumption from the type system
- Template label changed from "Critical Risk Alert" → "Risk Alert"
- Add a `risk.severityLabel` template variable (capitalised display form, e.g. "Critical") alongside the existing `risk.severity` (raw lowercase value)
- Subject format: `⚠ {{risk.severityLabel}} Risk Alert: {{risk.title}} in {{project.name}}`
- Body heading: `⚠ {{risk.severityLabel}} Risk Identified`
- Body text: uses `{{risk.severity}}` (lowercase) inline — "A {{risk.severity}} risk has been raised…"
- Template card badge colour stays red (risk alerts are always attention-worthy regardless of severity)

## Context

- **Visuals:** None
- **References:** Existing `tpl-risk-alert` template in `frontend/src/data/emailTemplates.ts`
- **Product alignment:** N/A

## Standards Applied

None applicable (frontend-only change, no API or database involvement).
