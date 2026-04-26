import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.project import Project
from app.models.project_user import ProjectUser
from app.models.user import User
from app.schemas.admin_attachment import (
    AdminAttachmentOut,
    BulkDeleteAttachmentsRequest,
    BulkDeleteAttachmentsResponse,
)
from app.schemas.service_account import (
    ServiceAccountCreate,
    ServiceAccountCreated,
    ServiceAccountOut,
    ServiceAccountTokenReset,
    ServiceAccountUpdate,
)
from app.services import attachment_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _make_api_key() -> tuple[str, str]:
    """Returns (plaintext `mhub_<hex>`, sha256 hash). Plaintext is shown once only."""
    raw = secrets.token_hex(32)
    plaintext = f"mhub_{raw}"
    return plaintext, hashlib.sha256(plaintext.encode()).hexdigest()


@router.post("/service-accounts", response_model=ServiceAccountCreated, status_code=201)
async def create_service_account(
    body: ServiceAccountCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")

    plaintext, key_hash = _make_api_key()
    words = body.name.split()
    initials = "".join(w[0].upper() for w in words[:2]) if words else "SA"

    user = User(
        id=f"svc-{uuid.uuid4().hex[:8]}",
        name=body.name,
        email=body.email,
        department=body.department,
        initials=initials,
        is_service_account=True,
        api_key_hash=key_hash,
    )
    db.add(user)
    await db.flush()
    return ServiceAccountCreated(
        id=user.id,
        name=user.name,
        email=user.email,
        department=user.department,
        initials=user.initials,
        api_key=plaintext,
    )


@router.get("/service-accounts", response_model=list[ServiceAccountOut])
async def list_service_accounts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.is_service_account == True).order_by(User.name)
    )
    return [
        ServiceAccountOut(
            id=u.id,
            name=u.name,
            email=u.email,
            department=u.department,
            initials=u.initials,
        )
        for u in result.scalars().all()
    ]


@router.patch("/service-accounts/{user_id}", response_model=ServiceAccountOut)
async def update_service_account(
    user_id: str,
    body: ServiceAccountUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user or not user.is_service_account:
        raise HTTPException(status_code=404, detail="Service account not found")

    if body.email is not None and body.email != user.email:
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = body.email

    if body.name is not None:
        user.name = body.name
        words = body.name.split()
        user.initials = "".join(w[0].upper() for w in words[:2]) if words else "SA"

    if body.department is not None:
        user.department = body.department

    await db.flush()
    return ServiceAccountOut(
        id=user.id,
        name=user.name,
        email=user.email,
        department=user.department,
        initials=user.initials,
    )


@router.delete("/service-accounts/{user_id}", status_code=204)
async def delete_service_account(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user or not user.is_service_account:
        raise HTTPException(status_code=404, detail="Service account not found")

    # Clean up any project associations first to avoid FK violations
    await db.execute(delete(ProjectUser).where(ProjectUser.user_id == user_id))
    await db.delete(user)
    await db.flush()


@router.post("/service-accounts/{user_id}/reset-token", response_model=ServiceAccountTokenReset)
async def reset_service_account_token(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user or not user.is_service_account:
        raise HTTPException(status_code=404, detail="Service account not found")

    plaintext, key_hash = _make_api_key()
    user.api_key_hash = key_hash
    await db.flush()
    return ServiceAccountTokenReset(id=user.id, api_key=plaintext)


@router.get("/attachments", response_model=list[AdminAttachmentOut])
async def list_all_attachments(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all attachments across all projects, optionally filtered by status."""
    attachments = await attachment_service.get_all_attachments(db, status_filter=status)

    if not attachments:
        return []

    project_ids = {a.project_id for a in attachments}
    result = await db.execute(select(Project.id, Project.name).where(Project.id.in_(project_ids)))
    project_names = {row[0]: row[1] for row in result.all()}

    return [
        AdminAttachmentOut(
            id=a.id,
            project_id=a.project_id,
            project_name=project_names.get(a.project_id, "Unknown"),
            filename=a.filename,
            file_path=a.file_path,
            status=a.status,
            created_at=a.created_at.isoformat() if a.created_at else None,
        )
        for a in attachments
    ]


@router.post("/attachments/bulk-delete", response_model=BulkDeleteAttachmentsResponse)
async def bulk_delete_attachments(
    body: BulkDeleteAttachmentsRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Permanently delete selected attachments from DB and disk."""
    result = await attachment_service.bulk_hard_delete_attachments(db, body.ids)
    await db.commit()
    return BulkDeleteAttachmentsResponse(
        deleted=result["deleted"],
        not_found=result["not_found"],
    )
