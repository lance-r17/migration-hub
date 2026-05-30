from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin, _user_has_admin_role
from app.database import get_db
from app.models.user import User
from app.schemas.gbi import (
    GbiAssignProjectsRequest,
    GbiHierarchy,
    GbiNode,
    GbiUnassignProjectsRequest,
)
from app.services import gbi_service

router = APIRouter(prefix="/gbi", tags=["gbi"])


def _require_platform_lead_or_admin(current_user: User) -> None:
    if "platform_migration_lead" not in (current_user.role or "") and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads or Admins can manage GBI.",
        )


@router.get("", response_model=dict[str, Any] | None)
async def get_gbi_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await gbi_service.get_hierarchy(db)


@router.put("", response_model=dict[str, Any])
async def set_gbi_hierarchy(
    body: GbiHierarchy,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_platform_lead_or_admin(current_user)
    if not body.root:
        raise HTTPException(status_code=422, detail="Root node is required")
    return await gbi_service.set_hierarchy(db, body.root)


@router.post("/assign-projects", status_code=204)
async def assign_projects(
    body: GbiAssignProjectsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_platform_lead_or_admin(current_user)
    await gbi_service.assign_projects_to_gbi(db, body.gbi_id, body.project_ids)
    return None


@router.post("/unassign-projects", status_code=204)
async def unassign_projects(
    body: GbiUnassignProjectsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_platform_lead_or_admin(current_user)
    await gbi_service.unassign_projects_from_gbi(db, body.project_ids)
    return None
