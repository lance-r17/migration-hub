from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.dashboard import ActivityListOut, ActivityOut, OverallStatsOut
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=OverallStatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)):
    return await dashboard_service.compute_stats(db)


@router.get("/activity", response_model=list[ActivityOut])
async def get_activity(db: AsyncSession = Depends(get_db)):
    return await dashboard_service.get_recent_activity(db)
