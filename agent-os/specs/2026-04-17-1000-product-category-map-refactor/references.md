# References for Product Category Map Refactor

## Key Files

### Backend service
- **Location:** `backend/app/services/product_category_service.py`
- **Relevance:** Defines `PRODUCT_CATEGORY_MAP`, `get_category_for_product()`

### Backend router
- **Location:** `backend/app/routers/product_categories.py`
- **Relevance:** Exposes `GET /product-category-map` — returns list as-is, no changes needed

### Frontend types
- **Location:** `frontend/src/types/index.ts` (lines 57–62)
- **Relevance:** `ResourceCategory` union type and `ProductCategoryEntry` interface

### Frontend hook
- **Location:** `frontend/src/hooks/use-product-category.ts`
- **Relevance:** `useProductCategoryMap()` — extended with `getNameForProduct()`

### Frontend mock
- **Location:** `frontend/src/data/mock.ts`
- **Relevance:** `mockProductCategoryMap` + project resource entries

### Seed data
- **Location:** `backend/scripts/seed_data/projects.json`
- **Relevance:** Resource entries using product codes
