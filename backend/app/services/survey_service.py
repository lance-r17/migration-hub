from typing import Any

from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.config_store import ConfigStore
from app.schemas.survey import (
    ResourceSurveyConfigOut,
    ResourceSurveyConfigUpdate,
    SurveyConfigOut,
    SurveyConfigUpdate,
)

_SURVEY_KEY = "survey_config"
_RESOURCE_SURVEY_KEY = "resource_survey_config"

_DEFAULT_SURVEY = {"isActive": False, "questions": [], "updatedBy": "", "updatedAt": ""}
_DEFAULT_RESOURCE_SURVEY = {"groups": [], "updatedBy": "", "updatedAt": ""}


def _to_survey_out(data: dict[str, Any]) -> SurveyConfigOut:
    return SurveyConfigOut(
        is_active=data.get("isActive", False),
        questions=data.get("questions", []),
        updated_by=data.get("updatedBy", ""),
        updated_at=data.get("updatedAt", ""),
    )


def _to_resource_survey_out(data: dict[str, Any]) -> ResourceSurveyConfigOut:
    return ResourceSurveyConfigOut(
        groups=data.get("groups", []),
        updated_by=data.get("updatedBy", ""),
        updated_at=data.get("updatedAt", ""),
    )


async def get_survey_config(session: AsyncSession) -> SurveyConfigOut:
    row = await session.get(ConfigStore, _SURVEY_KEY)
    return _to_survey_out(row.value if row else _DEFAULT_SURVEY)


async def set_survey_config(session: AsyncSession, patch: SurveyConfigUpdate) -> SurveyConfigOut:
    row = await session.get(ConfigStore, _SURVEY_KEY)
    current = row.value if row else dict(_DEFAULT_SURVEY)
    if patch.is_active is not None:
        current["isActive"] = patch.is_active
    if patch.questions is not None:
        current["questions"] = patch.questions
    if patch.updated_by is not None:
        current["updatedBy"] = patch.updated_by
    if patch.updated_at is not None:
        current["updatedAt"] = patch.updated_at
    if row:
        row.value = current
        flag_modified(row, 'value')
    else:
        session.add(ConfigStore(key=_SURVEY_KEY, value=current))
    await session.flush()
    return _to_survey_out(current)


async def get_resource_survey_config(session: AsyncSession) -> ResourceSurveyConfigOut:
    row = await session.get(ConfigStore, _RESOURCE_SURVEY_KEY)
    return _to_resource_survey_out(row.value if row else _DEFAULT_RESOURCE_SURVEY)


async def set_resource_survey_config(
    session: AsyncSession, patch: ResourceSurveyConfigUpdate
) -> ResourceSurveyConfigOut:
    row = await session.get(ConfigStore, _RESOURCE_SURVEY_KEY)
    current = row.value if row else dict(_DEFAULT_RESOURCE_SURVEY)
    if patch.groups is not None:
        current["groups"] = patch.groups
    if patch.updated_by is not None:
        current["updatedBy"] = patch.updated_by
    if patch.updated_at is not None:
        current["updatedAt"] = patch.updated_at
    if row:
        row.value = current
        flag_modified(row, 'value')
    else:
        session.add(ConfigStore(key=_RESOURCE_SURVEY_KEY, value=current))
    await session.flush()
    return _to_resource_survey_out(current)
