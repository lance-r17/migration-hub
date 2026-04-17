# Product Category Map Refactor — Shaping Notes

## Scope

Replace the 9-entry PRODUCT_CATEGORY_MAP with 18 Alibaba Cloud products. Add `product_name` field to each entry. Update category taxonomy from {VM, Database, Buckets, Network, Other} to {computing, security, networking, database, storage, middleware, analytics-computing, monitoring}. Replace product code rendering in the UI with product names.

## Decisions

- `product_name` field added to `ProductCategoryEntry` — API returns it, frontend consumes it
- Old product codes renamed for consistency: `polarDB` → `polardb`, `redis` → `kvstore`, `dns` → `clouddns`
- Hook `useProductCategoryMap` extended with `getNameForProduct()` — fallback is the raw code
- Seed data and mock data updated to cover all 18 products

## Context

- **Visuals:** None
- **References:** `backend/app/services/product_category_service.py`, `frontend/src/data/mock.ts`, `frontend/src/hooks/use-product-category.ts`
- **Product alignment:** N/A
