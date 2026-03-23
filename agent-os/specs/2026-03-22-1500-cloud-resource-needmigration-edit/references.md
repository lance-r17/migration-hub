# References

## RiskEditDrawer

- **Location:** `frontend/src/components/drawers/RiskEditDrawer.tsx`
- **Relevance:** List-item edit pattern — editing a specific item in an array and saving the full updated array
- **Key patterns:** `editingItem | null` state in parent, `Sheet` used directly for footer layout control, two-zone footer (destructive left / actions right)

## NetworkConfigurationDrawer

- **Location:** `frontend/src/components/drawers/NetworkConfigurationDrawer.tsx`
- **Relevance:** Drawer mounted inside a section component, receiving section data and returning the full updated section object via `onSave`
- **Key patterns:** Draft state initialised from `data` on `open`, `onSave` returns complete `CurrentInfrastructure` object
