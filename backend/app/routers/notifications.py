from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's notifications, newest first."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    )
    return result.scalars().all()


@router.get("/unread-count", response_model=UnreadCountOut)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
    )
    return UnreadCountOut(count=result.scalar_one())


@router.post("/read-all", status_code=204)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
    await db.flush()


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.flush()
    return notification


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(notification)
    await db.flush()
