# Finance Page — Excel Billing Report Ingestion & Breakdown

## Context

The Finance page currently uses a custom CSV format for billing uploads. The real Alibaba Cloud billing exports are `.xlsx` files with rich breakdown data across two sheets. This spec replaces the CSV flow with native xlsx ingestion, adds per-product cost breakdown in the comparison drawer, and adds a configurable display currency (default CNY) so amounts render correctly for the team's actual billing data.

## xlsx Report Structure

**"Resources Set Summary" sheet:**
- Row 1 = headers: `Billing Period | Resources Set | Adjusted Amount | Discounted Amount | Total Waiver | Shared Pooling Amount | Final Amount`
- Col B (idx 1) = resource set name; Col G (idx 6) = Final Amount (lump sum)

**"Resources Set Billing" sheet:**
- Row 1 = headers (19 columns)
- Col E (idx 4) = resource set; Col F (idx 5) = cloud service/product; Col G (idx 6) = instance type; Col S (idx 18) = Final Amount
- Aggregated by (resource_set, product) — sum all instance types for same product

## Tasks

1. Save spec documentation
2. Backend: DB migration `0007_add_billing_breakdown_records`
3. Backend: Models + schemas (BillingBreakdownRecord, currency in threshold)
4. Backend: Service layer (xlsx parser, breakdown CRUD, currency in threshold)
5. Backend: New endpoints (POST /billing/upload multipart, GET /billing/breakdown)
6. Frontend: Types + services (BillingBreakdownRecord type, uploadBillingXlsx, getBillingBreakdown)
7. Frontend: Mock data + store (breakdown methods, currency default, mockBillingBreakdown)
8. Frontend: New BillingBreakdownDrawer component
9. Frontend: Refactor FinancePage (xlsx upload, currency, new drawer)
10. Frontend: Currency selector in BillingSettingsPage
