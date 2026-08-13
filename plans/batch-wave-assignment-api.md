# Plan: Batch Wave Assignment API

## Context

The current API only supports moving projects between waves one-by-one:
- `PATCH /api/v1/projects/{project_id}` with `{ "wave_id": "..." }`
- `PATCH /api/v1/projects/{project_id}/sections/waveId` with `{ "value": "..." }`

The existing `PATCH /api/v1/waves/{wave_id}/project-order` endpoint only updates the **display order** of projects already assigned to that wave; it does not change `project.wave_id`.

We need a new batch endpoint that assigns multiple projects to a target wave in one call, updates the wave's `project_order` (append + dedupe), preserves the caller-provided order of the project list, and cleans up source waves.

## Decisions

| Question | Decision |
|----------|----------|
| Endpoint | `POST /api/v1/waves/{wave_id}/assign-projects` (new route, leave existing endpoints untouched) |
| Dedup semantics | **Option A**: keep existing `project_order` intact, append only **new** IDs that are not already in the list. Payload order is preserved for the appended tail. The payload itself is also deduplicated (keep first occurrence). |
| Source-wave cleanup | **Yes**: remove moved project IDs from any other wave's `project_order`. |
| Missing/invalid IDs | **Option B**: skip missing projects, do not fail the whole request. Return a summary of applied and not-found IDs. |
| Response | Wrap the **full `WaveOut`** plus a summary: `{ "wave": WaveOut, "assigned": [...], "not_found": [...] }`. |
| Permissions | Restrict to `platform_migration_lead` or admin, matching the Wave Planning UI. |

## Approach

Add a new route `POST /api/v1/waves/{wave_id}/assign-projects` that:

1. Validates the caller is a Platform Migration Lead or admin.
2. Loads the target wave; returns `404` if missing.
3. Rejects assignment to a `completed` wave by reusing `project_service._check_wave_completed`.
4. Deduplicates the incoming `project_ids` list while preserving order.
5. Loads all provided projects with one `select ... where id in (...)` query.
6. For each found project:
   - Records its previous `wave_id` for source-wave cleanup.
   - Sets `project.wave_id` to the target wave.
   - Writes an audit entry (`event_type="wave_assigned"`) with the old/new wave ID.
7. Updates the target wave's `project_order`:
   - Start from the existing list.
   - Append only IDs from the payload that are **not already present**.
   - The tail order matches the deduplicated payload order.
8. Cleans up source waves: for every previous wave that lost a project, remove those project IDs from its `project_order`.
9. Flushes and returns the updated wave plus `assigned`/`not_found` arrays.

## Files to modify

| File | Change |
|------|--------|
| `backend/app/schemas/wave.py` | Add `WaveBatchAssignRequest` and `WaveBatchAssignOut` schemas. |
| `backend/app/services/wave_service.py` | Add `batch_assign_projects(session, wave, project_ids, actor)` service function. |
| `backend/app/auth.py` | Add `_user_has_platform_lead_role` helper (currently duplicated in `routers/projects.py`) and a `require_platform_lead_or_admin` dependency. |
| `backend/app/routers/waves.py` | Import the new dependency and add `POST /{wave_id}/assign-projects` route. |
| `backend/app/routers/projects.py` | (Optional cleanup) Replace the local `_user_has_platform_lead_role` with the shared helper from `app.auth`. |
| `backend/tests/test_waves.py` | Add tests for happy path, missing projects, completed-wave rejection, deduplication, source-wave cleanup, and permission denial. |
| `docs/backend/api.md` | Document the new endpoint under **Waves** and add `wave_assigned` to the audit event types table. |

## Reuse

- **`project_service._check_wave_completed`** (`backend/app/services/project_service.py`) — validates assignment to a non-completed wave.
- **`audit_service.append_entry`** (`backend/app/services/audit_service.py`) — logs each project's wave assignment.
- **`WaveOut.from_orm_with_dates`** / `_wave_out`** — serializes the wave in the response.
- **`category_milestone_service.batch_assign`** (`backend/app/services/category_milestone_service.py`) — pattern for a batch-assign service method.

## Implementation details

### Request/response schemas

```python
# backend/app/schemas/wave.py
class WaveBatchAssignRequest(BaseModel):
    project_ids: list[str]

class WaveBatchAssignOut(BaseModel):
    wave: WaveOut
    assigned: list[str]
    not_found: list[str]
```

### Service function sketch

```python
# backend/app/services/wave_service.py
async def batch_assign_projects(
    session: AsyncSession,
    wave: Wave,
    project_ids: list[str],
    actor: dict[str, Any],
) -> tuple[list[str], list[str]]:
    from app.services import audit_service, project_service
    from app.models.project import Project

    # 1. Deduplicate payload while preserving order.
    seen: set[str] = set()
    unique_ids = [pid for pid in project_ids if not (pid in seen or seen.add(pid))]

    # 2. Load projects in one query.
    result = await session.execute(select(Project).where(Project.id.in_(unique_ids)))
    project_map = {p.id: p for p in result.scalars().all()}

    assigned: list[str] = []
    not_found: list[str] = []
    source_wave_ids: set[str] = set()

    for pid in unique_ids:
        project = project_map.get(pid)
        if not project:
            not_found.append(pid)
            continue

        old_wave_id = project.wave_id
        if old_wave_id and old_wave_id != wave.id:
            source_wave_ids.add(old_wave_id)

        # Block assignment to completed wave only if the project is actually changing.
        if project.wave_id != wave.id:
            await project_service._check_wave_completed(session, wave.id)
            project.wave_id = wave.id
            await audit_service.append_entry(
                session,
                project_id=project.id,
                event_type="wave_assigned",
                entity_type="wave",
                actor=actor,
                entity_id=wave.id,
                entity_label=wave.name,
                changes=[{
                    "field": "wave_id",
                    "label": "Wave",
                    "old_value": old_wave_id,
                    "new_value": wave.id,
                }],
            )
            assigned.append(pid)

    # 3. Update target wave project_order: append only truly new IDs.
    current_order = wave.project_order or []
    current_set = set(current_order)
    wave.project_order = current_order + [pid for pid in unique_ids if pid not in current_set]

    # 4. Clean up source waves' project_order arrays.
    if source_wave_ids:
        result = await session.execute(select(Wave).where(Wave.id.in_(list(source_wave_ids))))
        for src in result.scalars().all():
            if src.project_order:
                src.project_order = [pid for pid in src.project_order if pid not in assigned]

    await session.flush()
    await session.refresh(wave)
    return assigned, not_found
```

### Route handler sketch

```python
# backend/app/routers/waves.py
@router.post("/{wave_id}/assign-projects", response_model=WaveBatchAssignOut)
async def assign_projects_to_wave(
    wave_id: str,
    body: WaveBatchAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_platform_lead_or_admin),
):
    wave = await wave_service.get_by_id(db, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    actor = {
        "id": current_user.id,
        "name": current_user.name,
        "initials": current_user.initials,
    }
    assigned, not_found = await wave_service.batch_assign_projects(
        db, wave, body.project_ids, actor
    )
    await db.commit()
    return WaveBatchAssignOut(wave=_wave_out(wave), assigned=assigned, not_found=not_found)
```

### Auth helper

```python
# backend/app/auth.py
_ADMIN_ROLES = {"admin"}


def _user_has_platform_lead_role(role: str | None) -> bool:
    if not role:
        return False
    user_roles = {r.strip() for r in role.split(",") if r.strip()}
    return "platform_migration_lead" in user_roles


async def require_platform_lead_or_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not _user_has_platform_lead_role(current_user.role) and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Migration Lead or Admin role required",
        )
    return current_user
```

Then import in `backend/app/routers/waves.py`:

```python
from app.auth import get_current_user, require_platform_lead_or_admin
```

## Steps

- [ ] Add `_user_has_platform_lead_role` and `require_platform_lead_or_admin` to `backend/app/auth.py`.
- [ ] (Optional) Replace the duplicate `_user_has_platform_lead_role` in `backend/app/routers/projects.py` with the shared helper.
- [ ] Add `WaveBatchAssignRequest` and `WaveBatchAssignOut` to `backend/app/schemas/wave.py`.
- [ ] Implement `wave_service.batch_assign_projects` in `backend/app/services/wave_service.py`.
- [ ] Add `POST /{wave_id}/assign-projects` route to `backend/app/routers/waves.py`.
- [ ] Create `backend/tests/test_waves.py` and add tests:
  - [ ] Assign multiple projects to a wave and verify `wave_id` and `project_order`.
  - [ ] Deduplicate payload IDs (keep first occurrence).
  - [ ] Skip already-present IDs in target wave's `project_order` (append-only).
  - [ ] Remove moved IDs from the source wave's `project_order`.
  - [ ] Return missing IDs in `not_found` without failing.
  - [ ] Reject assignment to a `completed` wave.
  - [ ] Deny access for non-lead, non-admin users.
- [ ] Run backend tests and lint.
- [ ] Update API documentation in `docs/backend/api.md`:
  - [ ] Add the new endpoint under **Waves**.
  - [ ] Add `wave_assigned` to the **Audit event types** table (it is missing).

## Verification

1. **Backend tests**: run `pytest backend/tests/test_waves.py`.
2. **Manual API test** (with local dev server or via Swagger):
   ```bash
   curl -X POST http://localhost:8000/api/v1/waves/{wave_b_id}/assign-projects \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"project_ids": ["proj-1", "proj-2", "proj-1", "missing-id"]}'
   ```
   Expected response includes full wave data, `assigned: ["proj-1", "proj-2"]`, and `not_found: ["missing-id"]`. Target wave `project_order` has the new IDs appended at the end in order, and source wave no longer lists them.
3. **Frontend integration** (optional): update `frontend/src/services/waves.ts` to expose the new endpoint and use it in `WavePlanningBoard` batch selection if desired.
