# Delete Billing Month — Shaping Notes

## Scope

Add a trash icon button next to the month selector on the Finance page. Clicking it prompts for confirmation, then deletes all billing records for that month (both existing and target environments, both lump-sum `billing_record` and `billing_breakdown_record` tables).

## Decisions

- Delete covers both envs in one call (no per-env granularity needed)
- `window.confirm` used for confirmation — no custom dialog component needed
- Backend returns 204 No Content; client.ts already handles this correctly
- DELETE endpoint path: `DELETE /billing/month?month=YYYY-MM`

## Context

- **Visuals:** None
- **References:** `upsert_records` / `upsert_breakdown_records` in `billing_service.py` — same SQLAlchemy delete pattern reused
- **Product alignment:** N/A

## Standards Applied

- N/A — no standards files found in `agent-os/standards/`
