# References for Section Edit Drawers

## Similar Implementations

### SectionCard
- **Location:** `frontend/src/components/shared/SectionCard.tsx`
- **Relevance:** The component being modified — needs `onEdit` prop added
- **Key patterns:** `headerRight` ReactNode slot, `MotionCard` wrapper, CardHeader/CardContent structure

### Sheet (Radix UI)
- **Location:** `frontend/src/components/ui/sheet.tsx`
- **Relevance:** The drawer shell to use for all edit panels
- **Key patterns:** `SheetContent side="right"`, `SheetHeader`, `SheetFooter`, `SheetClose`, `showCloseButton` prop

### ProjectDetailsPage
- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx`
- **Relevance:** Needs state lift from read-only lookup to `useState`; provides `onSave` callbacks to all sections
- **Key patterns:** Currently `const project = mockProjects.find(p => p.id === id)` → needs `useState`

### CloudResourcesSection (excluded reference)
- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx`
- **Relevance:** The EXCLUDED section — no edit button added here. Uses `headerRight` for "RUN DISCOVERY SCAN" button — shows how existing `headerRight` usage must be preserved alongside the new pencil button.

### SignOffModal
- **Location:** `frontend/src/components/modals/SignOffModal.tsx`
- **Relevance:** Existing modal pattern showing how dialogs/drawers are used in this codebase

### TypeScript Interfaces
- **Location:** `frontend/src/types/index.ts`
- **Relevance:** All data interfaces (ApplicationOverview, AvailabilityResilience, DataPersistence, Dependencies, NonFunctionalRequirements, MigrationConstraints, TargetArchitecture, Risk) — these define the form fields for each drawer
