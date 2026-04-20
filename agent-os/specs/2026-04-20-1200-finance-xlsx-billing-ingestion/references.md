# References

## Similar Implementations

### Billing service pattern
- **Location:** `backend/app/services/billing_service.py`
- **Relevance:** upsert pattern (delete+insert), threshold config JSONB storage

### BillingSettingsPage
- **Location:** `frontend/src/pages/BillingSettingsPage.tsx`
- **Relevance:** How to add currency selector alongside existing threshold inputs

### Standard drawer pattern
- **Location:** `frontend/src/components/drawers/ResourceComparisonDrawer.tsx`
- **Key patterns:** `side="right" w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0`

### Mock data pattern
- **Location:** `frontend/src/data/mock.ts` (mockBillingExisting/mockBillingTarget)
- **Key patterns:** `Record<string, BillingRecord[]>` keyed by YYYY-MM month
