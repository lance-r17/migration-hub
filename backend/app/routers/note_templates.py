import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import _user_has_admin_role, get_current_user
from app.database import get_db
from app.models.note_template import NoteTemplate
from app.models.note_template_version import NoteTemplateVersion
from app.models.user import User

router = APIRouter(prefix="/note-templates", tags=["note-templates"])

logger = logging.getLogger(__name__)


def _template_out(t: NoteTemplate) -> dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "labels": t.labels,
        "blocks": t.blocks,
        "scope": t.scope,
        "sharedRoles": t.shared_roles,
        "createdBy": t.created_by,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    }


def _version_out(v: NoteTemplateVersion) -> dict[str, Any]:
    return {
        "id": v.id,
        "templateId": v.template_id,
        "versionNumber": v.version_number,
        "name": v.name,
        "description": v.description,
        "labels": v.labels,
        "blocks": v.blocks,
        "scope": v.scope,
        "sharedRoles": v.shared_roles,
        "createdBy": v.created_by,
        "createdAt": v.created_at.isoformat() if v.created_at else None,
    }


def _can_manage_global(user: User) -> bool:
    return "platform_migration_lead" in (user.role or "") or _user_has_admin_role(user.role)


def _user_roles(user: User) -> set[str]:
    return {r.strip() for r in (user.role or "").split(",") if r.strip()}


async def _next_version_number(session: AsyncSession, template_id: str) -> int:
    result = await session.execute(
        select(func.max(NoteTemplateVersion.version_number)).where(
            NoteTemplateVersion.template_id == template_id
        )
    )
    max_n = result.scalar() or 0
    return max_n + 1


async def _snapshot_version(
    session: AsyncSession,
    template: NoteTemplate,
    created_by: str | None,
) -> NoteTemplateVersion:
    """Save the current template state as a version snapshot."""
    version = NoteTemplateVersion(
        id=str(uuid.uuid4()),
        template_id=template.id,
        version_number=await _next_version_number(session, template.id),
        name=template.name,
        description=template.description,
        labels=list(template.labels or []),
        blocks=list(template.blocks or []),
        scope=template.scope,
        shared_roles=list(template.shared_roles or []),
        created_by=created_by,
    )
    session.add(version)
    await session.flush()
    return version


@router.get("")
async def list_note_templates(
    label: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List templates visible to the current user.

    Returns:
      - all global templates
      - the user's own private templates
      - function-specific templates where at least one of the user's roles
        overlaps with the template's shared_roles
    """
    user_roles = _user_roles(current_user)
    role_conditions = [
        NoteTemplate.shared_roles.contains([role]) for role in user_roles
    ]
    q = select(NoteTemplate).where(
        (NoteTemplate.scope == "global")
        | (NoteTemplate.created_by == current_user.id)
        | (or_(*role_conditions) if role_conditions else False)
    )
    if label:
        q = q.where(NoteTemplate.labels.contains([label]))
    q = q.order_by(NoteTemplate.name)
    result = await db.execute(q)
    return [_template_out(t) for t in result.scalars().all()]


@router.get("/{template_id}")
async def get_note_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = await db.get(NoteTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not _can_view(template, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view this template")
    return _template_out(template)


def _can_view(template: NoteTemplate, user: User) -> bool:
    if template.scope == "global":
        return True
    if template.created_by == user.id:
        return True
    user_roles = _user_roles(user)
    if any(r in user_roles for r in (template.shared_roles or [])):
        return True
    return False


def _can_manage(template: NoteTemplate, user: User) -> bool:
    """Can the user edit or delete this template?"""
    if template.created_by == user.id:
        return True
    if template.scope == "global" and _can_manage_global(user):
        return True
    # For function-specific templates, platform leads and admins can manage
    if template.scope == "function" and _can_manage_global(user):
        return True
    return False


@router.post("", status_code=201)
async def create_note_template(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = body.get("scope", "private")
    shared_roles = body.get("sharedRoles", [])

    if scope == "global" and not _can_manage_global(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads or Admins can create global templates.",
        )
    if scope == "function" and not _can_manage_global(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads or Admins can create function-specific templates.",
        )

    template = NoteTemplate(
        id=body.get("id") or str(uuid.uuid4()),
        name=body.get("name", "New Template"),
        description=body.get("description"),
        labels=body.get("labels", []),
        blocks=body.get("blocks", []),
        scope=scope,
        shared_roles=shared_roles,
        created_by=current_user.id,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return _template_out(template)


@router.put("/{template_id}")
async def update_note_template(
    template_id: str,
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = await db.get(NoteTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not _can_manage(template, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to update this template")

    # Snapshot current state as a version before applying changes
    await _snapshot_version(db, template, current_user.id)

    # Scope change restrictions
    new_scope = body.get("scope")
    if new_scope is not None and new_scope != template.scope:
        if new_scope in ("global", "function") and not _can_manage_global(current_user):
            raise HTTPException(
                status_code=403,
                detail="Only Platform Migration Leads or Admins can change template scope to global or function-specific.",
            )
        template.scope = new_scope

    if "sharedRoles" in body:
        if not _can_manage_global(current_user) and template.created_by != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to change shared roles.",
            )
        template.shared_roles = body["sharedRoles"]

    for key, col in [
        ("name", "name"),
        ("description", "description"),
        ("labels", "labels"),
        ("blocks", "blocks"),
    ]:
        if key in body:
            setattr(template, col, body[key])

    await db.flush()
    await db.refresh(template)
    return _template_out(template)


@router.delete("/{template_id}", status_code=204)
async def delete_note_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = await db.get(NoteTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not _can_manage(template, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to delete this template")

    await db.delete(template)


# ─── Version Control ─────────────────────────────────────────────────────────


@router.get("/{template_id}/versions")
async def list_template_versions(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List version history for a template."""
    template = await db.get(NoteTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not _can_view(template, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view this template")

    result = await db.execute(
        select(NoteTemplateVersion)
        .where(NoteTemplateVersion.template_id == template_id)
        .order_by(desc(NoteTemplateVersion.version_number))
    )
    return [_version_out(v) for v in result.scalars().all()]


@router.post("/{template_id}/versions/{version_id}/restore")
async def restore_template_version(
    template_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore a specific version as the current template state.

    The current state is snapshotted before restore so nothing is lost.
    """
    template = await db.get(NoteTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not _can_manage(template, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to restore this template")

    version = await db.get(NoteTemplateVersion, version_id)
    if not version or version.template_id != template_id:
        raise HTTPException(status_code=404, detail="Version not found")

    # Snapshot current state before restoring
    await _snapshot_version(db, template, current_user.id)

    # Apply version data to the template
    template.name = version.name
    template.description = version.description
    template.labels = list(version.labels or [])
    template.blocks = list(version.blocks or [])
    template.scope = version.scope
    template.shared_roles = list(version.shared_roles or [])

    await db.flush()
    await db.refresh(template)
    return _template_out(template)
