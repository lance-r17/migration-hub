from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.billing_record import BillingRecord
from app.models.config_store import ConfigStore
from app.schemas.billing import BillingThresholdConfigOut, BillingThresholdConfigUpdate, BillingUpload

_BILLING_THRESHOLD_KEY = "billing_threshold_config"
_DEFAULT_THRESHOLDS = {"healthyAtRiskThreshold": 100.0, "atRiskOverThreshold": 120.0}


async def get_months(session: AsyncSession, env: str) -> list[str]:
    result = await session.execute(
        select(BillingRecord.month).where(BillingRecord.env == env).distinct().order_by(BillingRecord.month)
    )
    return [r[0] for r in result.all()]


async def get_records(
    session: AsyncSession, month: str, env: str
) -> list[BillingRecord]:
    result = await session.execute(
        select(BillingRecord).where(
            BillingRecord.month == month, BillingRecord.env == env
        )
    )
    return list(result.scalars().all())


async def upsert_records(session: AsyncSession, upload: BillingUpload) -> None:
    # Delete existing records for (month, env)
    await session.execute(
        delete(BillingRecord).where(
            BillingRecord.month == upload.month, BillingRecord.env == upload.env
        )
    )
    # Insert new batch
    for rec in upload.records:
        session.add(BillingRecord(
            month=upload.month,
            env=upload.env,
            resource_set=rec.resource_set,
            amount=rec.amount,
        ))
    await session.flush()


async def get_threshold_config(session: AsyncSession) -> BillingThresholdConfigOut:
    row = await session.get(ConfigStore, _BILLING_THRESHOLD_KEY)
    data = row.value if row else _DEFAULT_THRESHOLDS
    return BillingThresholdConfigOut(
        healthy_at_risk_threshold=data.get("healthyAtRiskThreshold", 100.0),
        at_risk_over_threshold=data.get("atRiskOverThreshold", 120.0),
    )


async def update_threshold_config(
    session: AsyncSession, patch: BillingThresholdConfigUpdate
) -> BillingThresholdConfigOut:
    row = await session.get(ConfigStore, _BILLING_THRESHOLD_KEY)
    current = row.value if row else dict(_DEFAULT_THRESHOLDS)
    if patch.healthy_at_risk_threshold is not None:
        current["healthyAtRiskThreshold"] = patch.healthy_at_risk_threshold
    if patch.at_risk_over_threshold is not None:
        current["atRiskOverThreshold"] = patch.at_risk_over_threshold
    if row:
        row.value = current
        flag_modified(row, 'value')
    else:
        session.add(ConfigStore(key=_BILLING_THRESHOLD_KEY, value=current))
    await session.flush()
    return BillingThresholdConfigOut(
        healthy_at_risk_threshold=current["healthyAtRiskThreshold"],
        at_risk_over_threshold=current["atRiskOverThreshold"],
    )
