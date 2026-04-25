# Standards for Role snake_case Conversion

No formal standards directory exists in this project. The following de-facto conventions apply:

## Backend

- Alembic migrations use `op.execute()` for data migrations; follow sequential 4-digit revision IDs
- Python-based upgrade/downgrade with explicit `down_revision` chain

## Frontend

- Service layer `fromApi()` handles API→frontend mapping; `User.role` is already `string[]` via `userFromApi()` split
- Role comparisons use `.includes()` on the array; no change to this pattern
- Display label separation: stored values are identifiers; labels are rendered via a local map
