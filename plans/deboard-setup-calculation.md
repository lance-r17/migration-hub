# Deboard Projects: Relax Setup-Completion Calculation

## Context

Project status is derived from stage progress in `compute_stage_progress()`
(`backend/app/services/project_service.py`). Today the `setup` stage is binary:

```python
setup = 100 if (has_resources and has_team) else 0
```

where `has_resources` requires ≥1 cloud resource with `need_migration=True`, and
`has_team` requires ≥1 project member holding a governance role. A project with
`setup == 0` derives to status `planning`.

**Problem:** projects with migration strategy **Deboard** require no migration
(and typically have no in-scope resources), so they are stuck in `planning`
forever and can never reach `no-migration-required` — even though the
derivation rules already map a fully-prepared Deboard project to
`no-migration-required`.

**Enhancement:** when the project's migration strategy is `Deboard`, the setup
calculation ignores the "≥1 need_migration resource" condition — setup depends
only on the governance-role (team) condition.

## Approach

Single-point change in `compute_stage_progress()`: treat `has_resources` as
satisfied when the strategy is Deboard. The existing `_migration_strategy()`
helper in the same module already extracts the strategy from
`project.application_overview`.

```python
# project_service.py, compute_stage_progress()
is_deboard = _migration_strategy(project) == "Deboard"
has_resources = is_deboard or any(r.need_migration for r in (project.cloud_resources or []))
```

Everything downstream is untouched and picks up the change automatically:
- `derive_status_from_stage_progress()` already maps a fully-prepared Deboard
  project to `no-migration-required`.
- `update_section()` already re-derives and persists status when
  `applicationOverview` changes (setting the strategy to Deboard triggers it).
- All read serializers (`_derive_status`, `get_table_page`, `_matches_status_filter`)
  consume the same `stage_data`, so badges/filters stay consistent.
- Frontend needs **no change**: it never derives status (mock mode uses static
  fixture statuses), and `planning` presentation in `StatusBadge` is unchanged.

Resulting behavior for a Deboard project:
- governance role assigned, survey not submitted → `in-progress` (was `planning`)
- survey submitted + sign-off complete → `no-migration-required` (was unreachable)
- no governance role assigned → still `planning` (team condition still applies)

## Files to modify

- `backend/app/services/project_service.py` — `compute_stage_progress()` logic + docstring note
- `backend/tests/test_progress_weights.py` — add `application_overview=None` to the
  `_make_project()` base fixture (the function will now read that attribute), plus
  new tests for the Deboard setup rule

## Reuse

- `_migration_strategy(project)` — `backend/app/services/project_service.py:221`
  (extracts `migrationStrategy` from `application_overview`)
- Existing test fixtures `_make_project()` / `_resource()` / `_user()` in
  `backend/tests/test_progress_weights.py`

## Steps

- [ ] In `compute_stage_progress()`, compute `is_deboard` via `_migration_strategy(project)` and OR it into `has_resources`
- [ ] Update the `compute_stage_progress()` docstring to document the Deboard relaxation
- [ ] Add `application_overview=None` to `_make_project()` base fixture in `test_progress_weights.py`
- [ ] Add test: Deboard strategy, governance user, **no** resources → `setup == 100`
- [ ] Add test: Deboard strategy, no governance user, no resources → `setup == 0` (team condition still enforced)
- [ ] Add test (via `derive_status_from_stage_progress` or end-to-end pair): Deboard + setup/survey/signoff complete → `no-migration-required` (already covered by existing derive rule — verify still passing)
- [ ] Add test: non-Deboard strategy with no resources → `setup == 0` (regression guard)

## Verification

- Run `cd backend && .venv/bin/pytest tests/test_progress_weights.py` — all existing + new tests pass
- Run the full backend test suite (`tests/test_projects_home.py`, `tests/test_projects_table.py`) to confirm no status-filter regressions
- Manual sanity check (optional): create project → assign a governance role → set strategy to Deboard with zero in-scope resources → status reads `in-progress` instead of `planning`; complete survey + sign-offs → `no-migration-required`
