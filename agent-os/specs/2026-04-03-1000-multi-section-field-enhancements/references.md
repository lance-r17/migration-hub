# References for Multi-Section Field Enhancements

## Modified Files

### CloudResourcesSection
- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx`
- **Changes:** Removed Specs, Qty, AZ, Existing columns; added specs tooltip on resource name; Target column now shows `targetResourceId`; Category derived via `useProductCategoryMap()`

### CloudResourceEditDrawer
- **Location:** `frontend/src/components/drawers/CloudResourceEditDrawer.tsx`
- **Changes:** Removed Specs, Quantity, AZ, Existing Status read-only rows; Target Status row → Target Resource ID; Category derived via `useProductCategoryMap()`

### SignOffModal
- **Location:** `frontend/src/components/modals/SignOffModal.tsx`
- **Changes:** Added "Per Product" 4th toggle option; preview shows product groups with resource counts; config includes `selectedProducts`

### Types
- **Location:** `frontend/src/types/index.ts`
- **Changes:** Removed `category`, `quantity`, `availabilityZones`, `existingStatus` from `CloudResource`; renamed `targetStatus` → `targetResourceId`; added `ResourceCategory` type and `ProductCategoryEntry` interface

- **Location:** `frontend/src/types/wave.ts`
- **Changes:** Added `'product-level'` to `JiraSubtaskConfig.mode`; added `selectedProducts?: string[]`

### New Files

- `frontend/src/services/productCategory.ts` — fetches product-category mapping from backend (mock-ready)
- `frontend/src/hooks/use-product-category.ts` — React hook wrapping the service, provides `getCategoryForProduct(product?)` helper

### Mock Data
- `frontend/src/data/mock.ts` — Added `mockProductCategoryMap`; removed category/quantity/AZ/existingStatus from all resources; renamed targetStatus → targetResourceId
- `frontend/src/data/store.ts` — Exposed `getProductCategoryMap()` method
