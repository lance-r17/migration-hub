import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import _user_has_admin_role, require_admin
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
from app.schemas.user import (
    BatchUserCreateRequest,
    BatchUserCreateResponse,
    UserAdminUpdate,
    UserOut,
    UserProjectRoleOut,
)
from app.services import attachment_service, user_service

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
        role="admin" if body.is_admin else None,
    )
    db.add(user)
    await db.flush()
    return ServiceAccountCreated(
        id=user.id,
        name=user.name,
        email=user.email,
        department=user.department,
        initials=user.initials,
        is_admin=_user_has_admin_role(user.role),
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
            is_admin=_user_has_admin_role(u.role),
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

    if body.is_admin is not None:
        user.role = "admin" if body.is_admin else None

    await db.flush()
    return ServiceAccountOut(
        id=user.id,
        name=user.name,
        email=user.email,
        department=user.department,
        initials=user.initials,
        is_admin=_user_has_admin_role(user.role),
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


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all human users (non-service accounts), ordered by name."""
    result = await db.execute(
        select(User).where(User.is_service_account == False).order_by(User.name)
    )
    return result.scalars().all()


@router.get("/user-project-roles", response_model=list[UserProjectRoleOut])
async def list_all_user_project_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all project-user assignments with parsed roles."""
    result = await db.execute(
        select(ProjectUser, Project.name)
        .join(Project, Project.id == ProjectUser.project_id)
        .order_by(Project.name)
    )
    return [
        UserProjectRoleOut(
            user_id=pu.user_id,
            project_id=pu.project_id,
            project_name=project_name,
            roles=[r.strip() for r in (pu.role or "").split(",") if r.strip()],
        )
        for pu, project_name in result.all()
    ]


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Update a human user's details."""
    user = await db.get(User, user_id)
    if not user or user.is_service_account:
        raise HTTPException(status_code=404, detail="User not found")

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

    if body.team is not None:
        user.team = body.team

    if body.role is not None:
        user.role = body.role

    await db.flush()
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Delete a human user and clean up project associations."""
    user = await db.get(User, user_id)
    if not user or user.is_service_account:
        raise HTTPException(status_code=404, detail="User not found")

    # Clean up any project associations first to avoid FK violations
    await db.execute(delete(ProjectUser).where(ProjectUser.user_id == user_id))
    await db.delete(user)
    await db.flush()


@router.post("/users/batch", response_model=BatchUserCreateResponse, status_code=201)
async def batch_create_users(
    body: BatchUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Batch create human users. Existing users (matched by email) are skipped,
    but their records are still returned so callers can collect IDs.
    """
    created = 0
    skipped = 0
    result_users: list[User] = []
    seen_emails: set[str] = set()

    for u in body.users:
        email = u.email.lower()
        if email in seen_emails:
            continue
        seen_emails.add(email)

        user, was_created = await user_service.ensure_user(db, u.model_dump())
        result_users.append(user)
        if was_created:
            created += 1
        else:
            skipped += 1

    return BatchUserCreateResponse(
        created=created,
        skipped=skipped,
        users=[UserOut.model_validate(u) for u in result_users],
    )

