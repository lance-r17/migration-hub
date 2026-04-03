# References for Role Assignment Validation

## Similar Implementations

### ContactsOwnershipDrawer
- **Location:** `frontend/src/components/drawers/ContactsOwnershipDrawer.tsx`
- **Relevance:** The primary file being modified — 3 role selects with no validation today

### SectionEditDrawer
- **Location:** `frontend/src/components/drawers/SectionEditDrawer.tsx`
- **Relevance:** Save button is here; needs `saveDisabled` prop added

### Mock data structure
- **Location:** `frontend/src/data/mock.ts`
- **Violations:** M-11029 line ~376 (Frank Miller double role), M-77122 line ~536 (Henry Wilson as BO)
