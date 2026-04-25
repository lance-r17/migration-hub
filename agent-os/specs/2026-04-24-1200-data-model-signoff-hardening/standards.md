# Standards for Data Model & Sign-off Hardening

No `agent-os/standards/index.yml` was found in this repository. The following project-specific conventions apply:

## Backend API casing convention

- Backend columns and API responses use `snake_case`
- Frontend types use `camelCase`
- Service layer provides `fromApi` / `toApi` mappers
- `SectionPatch` body wraps value as `{ value: ... }`

## Role values (snake_case)

All stored role values are snake_case per migration 0008:
- `platform_migration_lead`
- `technical_lead`
- `business_owner`
- `dba_data_owner` (new — for `project_users.role`)

## JSONB mutation tracking

After in-place JSONB mutation, call `flag_modified(row, 'field')` before flush. Not required here since we're removing the `team` column entirely.

## SQLAlchemy async patterns

- Use `expire_on_commit=False` (already configured)
- Use `await session.flush()` not `commit()` inside service functions
- Use `selectinload` not `joinedload` for one-to-many relationships
