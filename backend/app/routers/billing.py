from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.billing import (
    BillingRecordOut,
    BillingThresholdConfigOut,
    BillingThresholdConfigUpdate,
    BillingUpload,
)
from app.services import billing_service

router = APIRouter(prefix="/billing", tags=["billing"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/months", response_model=list[str])
async def get_billing_months(env: str, db: AsyncSession = Depends(get_db)):
    return await billing_service.get_months(db, env)


@router.get("", response_model=list[BillingRecordOut])
async def get_billing_records(month: str, env: str, db: AsyncSession = Depends(get_db)):
    records = await billing_service.get_records(db, month, env)
    return [
        BillingRecordOut(month=r.month, env=r.env, resource_set=r.resource_set, amount=float(r.amount))
        for r in records
    ]


@router.post("", status_code=204)
async def upload_billing(body: BillingUpload, db: AsyncSession = Depends(get_db)):
    await billing_service.upsert_records(db, body)


@settings_router.get("/billing-thresholds", response_model=BillingThresholdConfigOut)
async def get_billing_thresholds(db: AsyncSession = Depends(get_db)):
    return await billing_service.get_threshold_config(db)


@settings_router.put("/billing-thresholds", response_model=BillingThresholdConfigOut)
async def update_billing_thresholds(
    body: BillingThresholdConfigUpdate, db: AsyncSession = Depends(get_db)
):
    return await billing_service.update_threshold_config(db, body)
