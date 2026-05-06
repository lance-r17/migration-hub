from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.billing import (
    BillingBreakdownRecordOut,
    BillingRecordOut,
    BillingThresholdConfigOut,
    BillingThresholdConfigUpdate,
    BillingUpload,
)
from app.schemas.migration_settings import MigrationSettingsOut, MigrationSettingsUpdate
from app.schemas.signoff import SignoffConfigOut, SignoffConfigUpdate
from app.services import billing_service, migration_settings_service, signoff_service

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


@router.post("/upload", status_code=204)
async def upload_billing_xlsx(
    month: str = Form(...),
    env: str = Form(...),
    file: UploadFile = ...,
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=422, detail="File must be an Excel file (.xlsx or .xls)")

    file_bytes = await file.read()
    try:
        summary_records, breakdown_records = billing_service.parse_xlsx_report(file_bytes, month, env)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    from app.schemas.billing import BillingRecordIn, BillingUpload as BU
    upload = BU(
        month=month,
        env=env,
        records=[BillingRecordIn(resource_set=r["resource_set"], amount=r["amount"]) for r in summary_records],
    )
    await billing_service.upsert_records(db, upload)
    await billing_service.upsert_breakdown_records(db, month, env, breakdown_records)


@router.delete("/month", status_code=204)
async def delete_billing_month(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
):
    await billing_service.delete_month_records(db, month)


@router.get("/breakdown", response_model=list[BillingBreakdownRecordOut])
async def get_billing_breakdown(
    month: str,
    env: str,
    resource_set: str,
    db: AsyncSession = Depends(get_db),
):
    records = await billing_service.get_breakdown_records(db, month, env, resource_set)
    return [
        BillingBreakdownRecordOut(
            month=r.month,
            env=r.env,
            resource_set=r.resource_set,
            product=r.product,
            amount=float(r.amount),
        )
        for r in records
    ]


@settings_router.get("/billing-thresholds", response_model=BillingThresholdConfigOut)
async def get_billing_thresholds(db: AsyncSession = Depends(get_db)):
    return await billing_service.get_threshold_config(db)


@settings_router.put("/billing-thresholds", response_model=BillingThresholdConfigOut)
async def update_billing_thresholds(
    body: BillingThresholdConfigUpdate, db: AsyncSession = Depends(get_db)
):
    return await billing_service.update_threshold_config(db, body)


@settings_router.get("/signoff", response_model=SignoffConfigOut)
async def get_signoff(db: AsyncSession = Depends(get_db)):
    return await signoff_service.get_signoff_config(db)


@settings_router.put("/signoff", response_model=SignoffConfigOut)
async def update_signoff(body: SignoffConfigUpdate, db: AsyncSession = Depends(get_db)):
    return await signoff_service.update_signoff_config(db, body)


@settings_router.get("/migration", response_model=MigrationSettingsOut)
async def get_migration_settings(db: AsyncSession = Depends(get_db)):
    return await migration_settings_service.get_migration_settings(db)


@settings_router.put("/migration", response_model=MigrationSettingsOut)
async def update_migration_settings(
    body: MigrationSettingsUpdate, db: AsyncSession = Depends(get_db)
):
    return await migration_settings_service.update_migration_settings(db, body)
