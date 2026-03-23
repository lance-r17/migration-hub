# Plan: Certificates & Secrets — Individual Section Cards

## Context

The "Certificates & Secrets" block inside `DependenciesSection` was a single card with stacked text rows. This refactor converts each field into its own `SectionCard` displayed in a 3-column grid, matching the visual pattern of `RisksBlockersSection`. An "Add" placeholder card is added at the end.

## Tasks

### Task 1: Save spec documentation ✅
Create this spec folder.

### Task 2: Refactor `DependenciesSection.tsx`
- Replace single `certificatesSecrets` card with `CertSecretsGrid` component
- 3-column grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- One `SectionCard` per defined field (tlsCertificates, secretsManagement, apiKeys)
- Add placeholder "Add Certificate or Secret" card
- New icons: `Key` (Secrets Management), `KeyRound` (API Keys), `ShieldCheck` (TLS — already imported), `Plus` (placeholder)
