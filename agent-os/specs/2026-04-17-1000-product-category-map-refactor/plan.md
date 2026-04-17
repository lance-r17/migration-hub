# Plan: Refactor PRODUCT_CATEGORY_MAP with New Structure

## Context

The current `PRODUCT_CATEGORY_MAP` has 9 entries with old product codes (polarDB, redis, dns) and coarse categories (VM, Database, Buckets, Network, Other). This refactor replaces it with 18 Alibaba Cloud product entries using standardized lowercase codes, human-readable product names, and a richer category taxonomy. The frontend displays product names (e.g. "Elastic Compute Service") instead of raw codes (e.g. "ecs").

## Tasks

1. Save spec documentation
2. Update `backend/app/services/product_category_service.py`
3. Update `frontend/src/types/index.ts`
4. Update `frontend/src/data/mock.ts` (map + project resources)
5. Update `backend/scripts/seed_data/projects.json`
6. Update `frontend/src/hooks/use-product-category.ts`
7. Replace product code rendering in 5 frontend components
