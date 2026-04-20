# Finance xlsx Billing Ingestion — Shaping Notes

## Scope

Replace CSV billing upload with native Alibaba Cloud xlsx report ingestion. Extract two datasets: lump-sum per resource set (for existing comparison table) and per-product breakdown (for new drawer). Add configurable currency defaulting to CNY.

## Decisions

- Use `openpyxl` for xlsx parsing on the backend (already in pyproject.toml ecosystem)
- New `billing_breakdown_records` table stores (month, env, resource_set, product, amount)
- Currency stored in existing `config_store` JSONB alongside threshold values
- Row click in Finance table opens new `BillingBreakdownDrawer` instead of `ResourceComparisonDrawer`
- Breakdown fetches both envs in parallel when drawer opens (lazy load)
- Keep two-card upload layout (existing env / target env) — just change file type from .csv to .xlsx

## Context

- **Visuals:** None provided
- **References:** `ResourceComparisonDrawer`, `BillingSettingsPage`, `billing_service.py` (existing patterns)
- **Product alignment:** Finance page is Platform Migration Lead-only; billing data is Alibaba Cloud CNY
