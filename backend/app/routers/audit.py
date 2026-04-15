from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.audit_log import AuditLogEntryOut, AuditLogResponse
from app.services import audit_service

router = APIRouter(tags=["audit"])


@router.get("/projects/{project_id}/audit-log", response_model=AuditLogResponse)
async def get_audit_log(project_id: str, db: AsyncSession = Depends(get_db)):
    entries = await audit_service.get_by_project(db, project_id)
    return AuditLogResponse(
        entries=[AuditLogEntryOut.from_orm_entry(e) for e in entries],
        total=len(entries),
    )
