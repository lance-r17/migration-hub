# Section Edit Drawers — Full Plan

## Overview

Add a pencil icon button to SectionCard headers (except "Compute & Resources") on the ProjectDetailsPage. Clicking opens a right-side Sheet drawer with a section-specific form. Saving updates React in-memory project state.

**Sections receiving edit buttons (8):** Application Overview, Risks & Blockers, Data Persistence, Availability & Resilience, Dependencies, Non-Functional Requirements, Migration Constraints, Target Architecture

**Section excluded:** Current Infrastructure (Compute & Resources)

---

## Task 1: Save Spec Documentation ✅

Created `agent-os/specs/2026-03-22-1200-section-edit-drawers/` with shape.md, standards.md, references.md, plan.md.

---

## Task 2: Add `onEdit` prop to SectionCard

**File:** `frontend/src/components/shared/SectionCard.tsx`

Add `onEdit?: () => void` prop. When provided, render a ghost pencil icon button as a third item in the header row (after `headerRight`). Use `e.stopPropagation()` on click.

---

## Task 3: Create `SectionEditDrawer` wrapper

**File:** `frontend/src/components/drawers/SectionEditDrawer.tsx`

Sheet wrapper with title, scrollable body, and Save/Cancel footer. Width: `w-[480px] sm:max-w-[480px]`.

---

## Task 4: Create `StringListEditor` micro-component

**File:** `frontend/src/components/drawers/StringListEditor.tsx`

Reusable add/remove string list editor for array-typed fields.

---

## Task 5: Create 8 drawer form components

All in `frontend/src/components/drawers/`:

| File | Section | Notable fields |
|---|---|---|
| `ApplicationOverviewDrawer.tsx` | Application Overview | Contact sub-objects, applicationTier Select |
| `AvailabilityResilienceDrawer.tsx` | Availability & Resilience | Checkboxes, StringListEditor for endpoints |
| `DataPersistenceDrawer.tsx` | Data Persistence | StringListEditors for arrays, piiData Checkbox |
| `DependenciesDrawer.tsx` | Dependencies | DependencyTableEditor sub-component for upstream/downstream arrays |
| `NonFunctionalRequirementsDrawer.tsx` | NFRs | compliance StringListEditor |
| `MigrationConstraintsDrawer.tsx` | Migration Constraints | blackoutDates/changeFreezePeriods StringListEditors |
| `TargetArchitectureDrawer.tsx` | Target Architecture | reArchitectureNeeded Checkbox, newServicesRequired StringListEditor |
| `RisksDrawer.tsx` | Risks & Blockers | Per-risk edit/create/delete, severity Select |

All drawers reset draft state via `useEffect` on `open` change.

---

## Task 6: Wire drawers into section components

Each section file receives an `onSave` prop and manages `drawerOpen` state locally. Pass `onEdit={() => setDrawerOpen(true)}` to each SectionCard within the section. Render the drawer at the bottom of the section's JSX.

For `RisksBlockersSection`: also manage `editingRisk: Risk | null` state. Each risk card's `onEdit` sets the editing risk. "Add Risk" placeholder opens drawer in create mode.

---

## Task 7: Lift project state in ProjectDetailsPage

**File:** `frontend/src/pages/ProjectDetailsPage.tsx`

Replace read-only `const project = mockProjects.find(...)` with `useState`. Add `handleSave<K>(key, value)` helper. Pass typed `onSave` callbacks to all 8 section components.

---

## Verification

1. `npm run dev` in `frontend/`
2. Open any project detail page
3. Pencil icon visible in all section headers except Compute & Resources
4. Click pencil → drawer slides in from right with pre-populated fields
5. Edit fields → Save → drawer closes, card shows updated data
6. Reopen drawer → shows saved values
7. Cancel → no changes applied
8. Risks section: per-risk edit button opens that risk's form; "Add Risk" opens blank form; Delete removes risk
