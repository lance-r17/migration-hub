from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.config_store import ConfigStore
from app.schemas.signoff import SignoffConfigOut, SignoffConfigUpdate

_SIGNOFF_KEY = "signoff_config"
_DEFAULT = {"enabled": True}


async def get_signoff_config(session: AsyncSession) -> SignoffConfigOut:
    row = await session.get(ConfigStore, _SIGNOFF_KEY)
    data = row.value if row else _DEFAULT
    return SignoffConfigOut(enabled=data.get("enabled", True))


async def update_signoff_config(
    session: AsyncSession, patch: SignoffConfigUpdate
) -> SignoffConfigOut:
    row = await session.get(ConfigStore, _SIGNOFF_KEY)
    current = row.value if row else dict(_DEFAULT)
    current["enabled"] = patch.enabled
    if row:
        row.value = current
        flag_modified(row, "value")
    else:
        session.add(ConfigStore(key=_SIGNOFF_KEY, value=current))
    await session.flush()
    return SignoffConfigOut(enabled=current["enabled"])
