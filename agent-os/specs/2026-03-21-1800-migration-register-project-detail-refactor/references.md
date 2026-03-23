# References for Migration Register Project Detail Refactor

## Files Modified

| File | Change |
| --- | --- |
| `frontend/src/types/index.ts` | Complete schema expansion — new interfaces for all 10 register sections |
| `frontend/src/data/mock.ts` | PRJ-2024-ALPHA updated with full register data; stub projects unchanged |
| `frontend/src/components/project/ApplicationOverviewSection.tsx` | Refactored — `data?: ApplicationOverview` prop, 2-col key-value grid |
| `frontend/src/components/project/CloudResourcesSection.tsx` | Renamed export → `CurrentInfrastructureSection`; extended table + network sub-section |
| `frontend/src/components/project/AvailabilitySection.tsx` | Renamed export → `AvailabilityResilienceSection`; 9-field 2-col grid + topology block |
| `frontend/src/components/project/DataSecuritySection.tsx` | Renamed export → `DataPersistenceSection`; 10-field 2-col grid |
| `frontend/src/components/project/DependenciesSection.tsx` | Tables replacing tag-clouds; Certificates & Secrets sub-section added |
| `frontend/src/components/project/MigrationCutoverSection.tsx` | Renamed export → `MigrationConstraintsSection`; 2 new fields, typo fixed |
| `frontend/src/components/project/TargetArchitectureSection.tsx` | 6 new fields in second grid below existing summary/constraints |
| `frontend/src/components/project/RisksBlockersSection.tsx` | Added mitigation, owner, riskStatus to each risk card |
| `frontend/src/pages/ProjectDetailsPage.tsx` | Updated imports, metadata strip added, bento grid props updated |
| `frontend/src/components/layout/AppSidebar.tsx` | Pre-existing unused `FolderIcon` import removed |
