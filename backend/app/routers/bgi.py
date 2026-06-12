from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin, _user_has_admin_role
from app.database import get_db
from app.models.user import User
from app.schemas.bgi import (
    BgiAssignProjectsRequest,
    BgiHierarchy,
    BgiNode,
    BgiUnassignProjectsRequest,
)
from app.services import bgi_service

router = APIRouter(prefix="/bgi", tags=["bgi"])


def _require_platform_lead_or_admin(current_user: User) -> None:
    if "platform_migration_lead" not in (current_user.role or "") and not _user_has_admin_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Only Platform Migration Leads or Admins can manage BGI.",
        )


@router.get("", response_model=dict[str, Any] | None)
async def get_bgi_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await bgi_service.get_hierarchy(db)


@router.put("", response_model=dict[str, Any])
async def set_bgi_hierarchy(
    body: BgiHierarchy,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_platform_lead_or_admin(current_user)
    if not body.root:
        raise HTTPException(status_code=422, detail="Root node is required")
    return await bgi_service.set_hierarchy(db, body.root)


@router.post("/assign-projects", status_code=204)
async def assign_projects(
    body: BgiAssignProjectsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_platform_lead_or_admin(current_user)
    await bgi_service.assign_projects_to_bgi(db, body.bgi_id, body.project_ids)
    return None


@router.post("/unassign-projects", status_code=204)
async def unassign_projects(
    body: BgiUnassignProjectsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_platform_lead_or_admin(current_user)
    await bgi_service.unassign_projects_from_bgi(db, body.project_ids)
    return None
