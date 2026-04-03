# Multi-Section Field Enhancements — Plan

## Context

The Compute & Resources table currently has columns that add clutter (specs as a visible column, quantity, availability zones, existing status) or store data redundantly (category per resource). The target field semantics are changing from a status string to a target environment resource ID. Additionally, the Jira sub-task grouping modal is missing a "per product" option. This plan cleans up the table UI, introduces a product→category mapping table, and extends the sign-off workflow.

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-03-1000-multi-section-field-enhancements/` with `plan.md`, `shape.md`, and `references.md`.

---

## Task 2: Update Types

**File:** `frontend/src/types/index.ts`

- Remove `category`, `quantity`, `availabilityZones`, `existingStatus` from `CloudResource`
- Rename `targetStatus: string` → `targetResourceId?: string` (resource ID in target environment)

**File:** `frontend/src/types/wave.ts`

- Add `'product-level'` to `JiraSubtaskConfig.mode` union
- Add `selectedProducts?: string[]` to `JiraSubtaskConfig` for use when mode is `'product-level'`

---

## Task 3: Add Product→Category Mapping via API

The mapping is not a hardcoded constant — it is fetched from the backend.

**`frontend/src/types/index.ts`** — add type:
```typescript
export type ResourceCategory = 'VM' | 'Database' | 'Buckets' | 'Network' | 'Other'
export interface ProductCategoryEntry { product: string; category: ResourceCategory }
```

**`frontend/src/data/mock.ts`** — add mock table:
```typescript
export const mockProductCategoryMap: ProductCategoryEntry[] = [
  { product: 'ecs',      category: 'VM' },
  { product: 'rds',      category: 'Database' },
  { product: 'polarDB',  category: 'Database' },
  { product: 'oss',      category: 'Buckets' },
  { product: 'slb',      category: 'Network' },
  { product: 'dns',      category: 'Network' },
  { product: 'sls',      category: 'Other' },
  { product: 'Other',    category: 'Other' },
]
```

**`frontend/src/services/productCategory.ts`** (new) — service layer:
```typescript
export async function fetchProductCategoryMap(): Promise<ProductCategoryEntry[]>
// returns mockProductCategoryMap with a simulated async delay, matching the existing service pattern
```

**`frontend/src/hooks/use-product-category.ts`** (new) — hook:
```typescript
export function useProductCategoryMap(): {
  map: Record<string, ResourceCategory>;
  loading: boolean;
  getCategoryForProduct: (product?: string) => ResourceCategory
}
```

Components (`CloudResourcesSection`, `CloudResourceEditDrawer`, `SignOffModal`) call `useProductCategoryMap()` to resolve categories and group by product.

---

## Task 4: Update Mock Data

**File:** `frontend/src/data/mock.ts`

- Remove `category`, `quantity`, `availabilityZones`, `existingStatus` from every resource entry
- Rename `targetStatus` → `targetResourceId` with placeholder IDs (e.g. `'i-target-001'`)

---

## Task 5: Update CloudResourcesSection Table

**File:** `frontend/src/components/project/CloudResourcesSection.tsx`

Table column changes:
- **Remove** Specs column header + cell — replace with an `<Info>` icon (lucide-react) next to the resource name that triggers a `Tooltip` showing specs key-value pairs (use shadcn `Tooltip`/`TooltipContent`). If no specs, icon is hidden.
- **Remove** Qty, Availability Zones, Existing columns (headers + cells)
- **Change** Target column: display `resource.targetResourceId` as monospace text (same `font-mono` style as Resource ID). Label stays "Target Resource ID".
- **Category column**: derive via `getCategoryForProduct(resource.product)` from `useProductCategoryMap()` instead of `resource.category`

---

## Task 6: Update CloudResourceEditDrawer

**File:** `frontend/src/components/drawers/CloudResourceEditDrawer.tsx`

- Remove `ReadOnlyRow` entries for: Specs, Quantity, Availability Zones, Existing Status
- Change "Target Status" row → "Target Resource ID", displaying `resource.targetResourceId`
- Category row: compute via `getCategoryForProduct(resource.product)` from `useProductCategoryMap()` instead of `resource.category`

---

## Task 7: Update SignOffModal — Add "Per Product" Option

**File:** `frontend/src/components/modals/SignOffModal.tsx`

Step 2 grouping options currently: Per Resource | Per Category | Custom

Add fourth toggle: **Per Product** (`mode === 'product-level'`)

- When selected, group `inScopeResources` by `resource.product`, one sub-task per unique product
- Preview list shows product names with count of resources in that group (e.g. "ecs (3 resources)")
- Subtitle count reflects number of distinct products
- `selectedProducts` field in config is not needed for the basic mode (all products are included by default, like category-level)

Also update `category-level` grouping logic to derive category via `getCategoryForProduct(resource.product)` from `useProductCategoryMap()` rather than `resource.category`.

---

## Task 8: Update store.ts (if needed)

**File:** `frontend/src/data/store.ts`

Check for any references to removed fields (`category`, `quantity`, `availabilityZones`, `existingStatus`, `targetStatus`) and update to match new type shape.

---

## Verification

1. Open any project detail page → Compute & Resources table should show no Specs, Qty, AZ, or Existing columns
2. Hover the info icon next to a resource name → tooltip shows specs key-value pairs
3. Target column shows a resource ID string in monospace
4. Category column still shows correct derived category (VM, Database, etc.)
5. Open edit drawer for a resource → specs/qty/AZ/existing rows are gone, target shows resource ID
6. Sign off as Platform Migration Lead → Step 2 shows 4 grouping options including "Per Product"
7. Selecting "Per Product" shows correct preview grouped by product type
8. No TypeScript errors (`npm run typecheck` or equivalent)
