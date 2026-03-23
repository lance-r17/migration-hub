# Migration Register — Project Details Refactor — Shaping Notes

## Scope

Full refactor of the project details page data schema and all 9 section components to match the authoritative migration project register document (`migration_project_register.md`). The register defines 10 sections; the previous schema covered ~50% of required fields.

## Decisions

- Keep `CloudResource` interface, extend it with `specs?`, `quantity?`, `availabilityZones?` so it covers all resource types (Compute, Storage, Database, Buckets) without separate `ComputeNode` type
- Compose `CurrentInfrastructure` as `{ resources: CloudResource[], network?: NetworkConfig }` — user's preferred structure
- Remove top-level `Project.resources` field; moved into `currentInfrastructure.resources`
- Rename type interfaces to match register section names (`DataPersistence`, `AvailabilityResilience`, `MigrationConstraints`)
- Keep file names unchanged for section components; only rename exported component functions
- Fix pre-existing typo: `cutoberApproach` → `cutoverApproach`

## Context

- **Visuals:** None
- **References:** `migration_project_register.md` (authoritative register spec)
- **Product alignment:** Core tracker functionality — every field in the register must be capturable

## Standards Applied

None defined yet in agent-os/standards/
