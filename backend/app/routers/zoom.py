from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.engagement import Engagement
from app.models.user import User
from app.services import zoom_service, project_service, user_service
from app.config import settings

router = APIRouter(prefix="/zoom", tags=["zoom"])


def _user_to_actor(user: User) -> dict[str, Any]:
    actor: dict[str, Any] = {"id": user.id, "name": user.name, "initials": user.initials}
    if user.is_service_account:
        actor["type"] = "service_account"
    return actor


@router.get("/status")
async def zoom_status() -> dict[str, bool]:
    return {
        "configured": bool(
            settings.zoom_account_id and settings.zoom_client_id and settings.zoom_client_secret
        )
    }


@router.post("/projects/{project_id}/engagement/schedule", status_code=201)
async def schedule_engagement_zoom(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule a Zoom meeting for the project's engagement actual slot.

    Requires ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET to be configured.
    """
    if not settings.zoom_account_id or not settings.zoom_client_id or not settings.zoom_client_secret:
        raise HTTPException(status_code=503, detail="Zoom integration is not configured")

    project = await project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    engagement = project.engagement
    if engagement is None:
        engagement = Engagement(
            id=__import__("uuid").uuid4().hex,
            project_id=project.id,
        )
        db.add(engagement)
        project.engagement = engagement
        await db.flush()

    planned_slots = engagement.planned_slots or []
    actual_slot = next((s for s in planned_slots if s.get("isActual")), None)
    if not actual_slot:
        raise HTTPException(status_code=422, detail="No actual interview slot is set")

    topic = engagement.interview_subject or f"Migration Interview — {project.name}"
    start_time = actual_slot["start"]
    start_dt = __import__("datetime").datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    end_dt = __import__("datetime").datetime.fromisoformat(actual_slot["end"].replace("Z", "+00:00"))
    duration = int((end_dt - start_dt).total_seconds() / 60)

    participant_ids = engagement.participant_ids or []
    participant_emails = []
    for uid in participant_ids:
        user = await user_service.get_by_id(db, uid)
        if user and user.email:
            participant_emails.append(user.email)

    try:
        result = await zoom_service.schedule_meeting(
            topic=topic,
            start_time=start_time,
            duration_minutes=max(duration, 30),
            participant_emails=participant_emails,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Zoom API error: {exc}")

    # Update engagement with Zoom meeting details
    engagement.zoom_meeting_id = str(result["id"])
    engagement.zoom_meeting_url = result.get("join_url") or result.get("start_url", "")
    # Persist back into the actual slot inside plannedSlots
    for s in planned_slots:
        if s.get("isActual"):
            s["zoomMeetingId"] = engagement.zoom_meeting_id
            s["zoomMeetingUrl"] = engagement.zoom_meeting_url
    engagement.planned_slots = planned_slots
    await db.flush()
    await db.commit()

    return {
        "zoomMeetingId": engagement.zoom_meeting_id,
        "zoomMeetingUrl": engagement.zoom_meeting_url,
    }
