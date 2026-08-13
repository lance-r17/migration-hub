from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.config_store import ConfigStore
from app.schemas.custom_nav_card import CustomNavCardOut, CustomNavCardUpdate

_KEY = "custom_nav_card"
_DEFAULT = {
    "title": "Help & Support",
    "description": "Open the support portal for guides, FAQs, and assistance.",
    "url": "https://example.com/support",
}


async def get_custom_nav_card(session: AsyncSession) -> CustomNavCardOut:
    row = await session.get(ConfigStore, _KEY)
    data = row.value if row else dict(_DEFAULT)
    return CustomNavCardOut(
        title=data.get("title", _DEFAULT["title"]),
        description=data.get("description", _DEFAULT["description"]),
        url=data.get("url", _DEFAULT["url"]),
    )


async def update_custom_nav_card(
    session: AsyncSession, patch: CustomNavCardUpdate
) -> CustomNavCardOut:
    row = await session.get(ConfigStore, _KEY)
    current = dict(row.value) if row else dict(_DEFAULT)

    if patch.title is not None:
        current["title"] = patch.title
    if patch.description is not None:
        current["description"] = patch.description
    if patch.url is not None:
        current["url"] = patch.url

    if row:
        row.value = current
        flag_modified(row, "value")
    else:
        session.add(ConfigStore(key=_KEY, value=current))

    await session.flush()
    return CustomNavCardOut(
        title=current.get("title", _DEFAULT["title"]),
        description=current.get("description", _DEFAULT["description"]),
        url=current.get("url", _DEFAULT["url"]),
    )
