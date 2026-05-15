import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.email_template import EmailTemplate
from app.config import settings
from app.services.email_service import send_email

router = APIRouter(prefix="/email-templates", tags=["email-templates"])

logger = logging.getLogger(__name__)


def _template_out(t: EmailTemplate) -> dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "eventType": t.event_type,
        "subject": t.subject,
        "recipientList": t.recipient_list,
        "templateStyle": t.template_style,
        "rows": t.rows,
        "htmlSnapshot": t.html_snapshot,
        "isPredefined": t.is_predefined,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/platform-config")
async def get_platform_config():
    """Return platform name, URL and email banner URL for template rendering."""
    return {
        "platformName": settings.platform_name,
        "platformUrl": settings.platform_url,
        "emailBannerUrl": settings.email_banner_url,
    }


@router.get("")
async def list_email_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailTemplate).order_by(EmailTemplate.name))
    return [_template_out(t) for t in result.scalars().all()]


@router.post("", status_code=201)
async def create_email_template(body: dict[str, Any], db: AsyncSession = Depends(get_db)):
    template = EmailTemplate(
        id=body.get("id") or str(uuid.uuid4()),
        name=body.get("name", "New Template"),
        description=body.get("description"),
        event_type=body.get("eventType", "custom"),
        subject=body.get("subject", ""),
        recipient_list=body.get("recipientList", []),
        template_style=body.get("templateStyle", {}),
        rows=body.get("rows", []),
        html_snapshot=body.get("htmlSnapshot"),
        is_predefined=body.get("isPredefined", False),
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return _template_out(template)


@router.post("/send-test", status_code=202)
async def send_test_email(body: dict[str, Any]):
    """Send a test email using pre-rendered HTML from the frontend."""
    recipient = body.get("recipientEmail")
    subject = body.get("subject") or "Test Email"
    html_content = body.get("htmlContent")

    if not recipient:
        raise HTTPException(status_code=400, detail="recipientEmail is required")
    if not html_content:
        raise HTTPException(status_code=400, detail="htmlContent is required")

    try:
        await send_email(
            to_addrs=[recipient],
            subject=subject,
            html_content=html_content,
        )
    except RuntimeError as exc:
        logger.warning("Email send failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error sending test email")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {exc}")

    return {"status": "sent", "message": f"Test email sent to {recipient}"}


@router.post("/send", status_code=202)
async def send_triggered_email(body: dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Send an actual email using a stored template and provided context data.

    The caller is responsible for rendering the HTML (e.g. frontend or another
    backend service). This endpoint handles transport only.
    """
    template_id = body.get("templateId")
    to_emails = body.get("toEmails", [])
    subject = body.get("subject")
    html_content = body.get("htmlContent")

    if not to_emails:
        raise HTTPException(status_code=400, detail="toEmails is required")
    if not html_content:
        raise HTTPException(status_code=400, detail="htmlContent is required")

    # Optionally load subject from template if not provided
    if template_id and not subject:
        template = await db.get(EmailTemplate, template_id)
        if template:
            subject = template.subject

    subject = subject or "Notification"

    try:
        await send_email(
            to_addrs=to_emails if isinstance(to_emails, list) else [to_emails],
            subject=subject,
            html_content=html_content,
        )
    except RuntimeError as exc:
        logger.warning("Email send failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error sending email")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {exc}")

    return {"status": "sent", "recipients": to_emails}


@router.get("/{template_id}")
async def get_email_template(template_id: str, db: AsyncSession = Depends(get_db)):
    template = await db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_out(template)


@router.put("/{template_id}")
async def update_email_template(
    template_id: str, body: dict[str, Any], db: AsyncSession = Depends(get_db)
):
    template = await db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    for key, col in [
        ("name", "name"), ("description", "description"), ("eventType", "event_type"),
        ("subject", "subject"), ("recipientList", "recipient_list"),
        ("templateStyle", "template_style"), ("rows", "rows"),
        ("htmlSnapshot", "html_snapshot"),
    ]:
        if key in body:
            setattr(template, col, body[key])
    await db.flush()
    await db.refresh(template)
    return _template_out(template)


@router.delete("/{template_id}", status_code=204)
async def delete_email_template(template_id: str, db: AsyncSession = Depends(get_db)):
    template = await db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
