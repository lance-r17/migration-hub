import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.email_template import EmailTemplate

router = APIRouter(prefix="/email-templates", tags=["email-templates"])


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
        "isPredefined": t.is_predefined,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
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
        is_predefined=body.get("isPredefined", False),
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return _template_out(template)


@router.post("/send-test", status_code=202)
async def send_test_email(body: dict[str, Any]):
    # Stub: log and return accepted
    return {"status": "accepted", "message": "Test email queued (stub)"}


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
