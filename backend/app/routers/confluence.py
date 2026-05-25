import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import _user_has_admin_role, get_current_user
from app.database import get_db
from app.models.confluence_parent_page import ConfluenceParentPage
from app.models.engagement import Engagement
from app.models.user import User
from app.services import confluence_service, project_service
from app.config import settings

router = APIRouter(prefix="/confluence", tags=["confluence"])

logger = logging.getLogger(__name__)


def _can_manage(user: User) -> bool:
    return "platform_migration_lead" in (user.role or "") or _user_has_admin_role(user.role)


def _parent_page_out(p: ConfluenceParentPage) -> dict[str, Any]:
    return {
        "id": p.id,
        "title": p.title,
        "spaceKey": p.space_key,
        "pageId": p.page_id,
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/status")
async def confluence_status() -> dict[str, Any]:
    configured = bool(
        settings.confluence_base_url
        and settings.confluence_api_token
        and settings.confluence_user_email
    )
    space_check: dict[str, Any] | None = None
    if configured and settings.confluence_space_key:
        space_check = await confluence_service.validate_space(settings.confluence_space_key)
    return {
        "configured": configured,
        "space": space_check,
    }


@router.get("/parent-pages")
async def list_parent_pages(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    result = await db.execute(select(ConfluenceParentPage).order_by(ConfluenceParentPage.title))
    return [_parent_page_out(p) for p in result.scalars().all()]


@router.get("/pages/search")
async def search_space_pages(
    query: str = "",
    _: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Search pages in the configured Confluence space."""
    if not (
        settings.confluence_base_url
        and settings.confluence_api_token
        and settings.confluence_user_email
    ):
        raise HTTPException(status_code=503, detail="Confluence integration is not configured")
    if not settings.confluence_space_key:
        raise HTTPException(status_code=503, detail="CONFLUENCE_SPACE_KEY is not configured")
    try:
        return await confluence_service.search_pages(settings.confluence_space_key, query)
    except Exception as exc:
        logger.exception("Confluence page search failed for space %s", settings.confluence_space_key)
        raise HTTPException(status_code=502, detail=f"Confluence API error: {exc}")


@router.post("/parent-pages", status_code=201)
async def create_parent_page(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if not _can_manage(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage parent pages")

    page = ConfluenceParentPage(
        id=body.get("id") or str(uuid.uuid4()),
        title=body.get("title", "Parent Page"),
        space_key=body.get("spaceKey", settings.confluence_space_key),
        page_id=body.get("pageId", ""),
    )
    db.add(page)
    await db.flush()
    await db.refresh(page)
    return _parent_page_out(page)


@router.delete("/parent-pages/{page_id}", status_code=204)
async def delete_parent_page(
    page_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if not _can_manage(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage parent pages")

    page = await db.get(ConfluenceParentPage, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Parent page not found")
    await db.delete(page)
    await db.flush()


@router.get("/pages/{page_id}/parent-page-id")
async def get_page_parent_page_id(
    page_id: str,
    current_user: User = Depends(get_current_user),
) -> dict[str, str | None]:
    """Return the direct parent Confluence page ID for the given page."""
    if not (settings.confluence_base_url and settings.confluence_api_token and settings.confluence_user_email):
        raise HTTPException(status_code=503, detail="Confluence integration is not configured")
    parent_id = await confluence_service.get_page_parent_id(page_id)
    return {"parentPageId": parent_id}


@router.post("/projects/{project_id}/engagement/export")
async def export_engagement_notes(
    project_id: str,
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Export or update engagement notes as a Confluence page."""
    if not (
        settings.confluence_base_url
        and settings.confluence_api_token
        and settings.confluence_user_email
    ):
        raise HTTPException(status_code=503, detail="Confluence integration is not configured")

    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    engagement = project.engagement
    if engagement is None:
        engagement = Engagement(
            id=uuid.uuid4().hex,
            project_id=project.id,
        )
        db.add(engagement)
        project.engagement = engagement
        await db.flush()

    notes = engagement.notes or []
    if not isinstance(notes, list):
        notes = []

    parent_page_record_id = body.get("parentPageId")
    move_to_root = "parentPageId" in body and parent_page_record_id is None
    parent_page_confluence_id: str | None = None
    if parent_page_record_id:
        parent_record = await db.get(ConfluenceParentPage, parent_page_record_id)
        if parent_record:
            parent_page_confluence_id = parent_record.page_id

    try:
        result = await confluence_service.export_engagement_notes(
            project_name=project.name,
            interview_subject=engagement.interview_subject,
            notes=notes,  # type: ignore[arg-type]
            existing_page_id=engagement.confluence_page_id,
            parent_page_id=parent_page_confluence_id,
            move_to_root=move_to_root,
        )
    except Exception as exc:
        logger.exception("Confluence export failed for project %s", project_id)
        raise HTTPException(status_code=502, detail=f"Confluence API error: {exc}")

    engagement.confluence_page_id = result["confluencePageId"]
    engagement.confluence_page_url = result["confluencePageUrl"]
    await db.flush()
    await db.commit()

    return {
        "confluencePageId": engagement.confluence_page_id,
        "confluencePageUrl": engagement.confluence_page_url,
    }
