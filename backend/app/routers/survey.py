from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.survey import (
    ResourceSurveyConfigOut,
    ResourceSurveyConfigUpdate,
    SurveyConfigOut,
    SurveyConfigUpdate,
)
from app.services import survey_service

router = APIRouter(prefix="/settings", tags=["survey"])


@router.get("/survey", response_model=SurveyConfigOut)
async def get_survey_config(db: AsyncSession = Depends(get_db)):
    return await survey_service.get_survey_config(db)


@router.put("/survey", response_model=SurveyConfigOut)
async def update_survey_config(body: SurveyConfigUpdate, db: AsyncSession = Depends(get_db)):
    return await survey_service.set_survey_config(db, body)


@router.get("/survey/field-defs")
async def get_survey_field_defs():
    from app.data.survey_field_defs import SURVEY_FIELD_DEFS
    return SURVEY_FIELD_DEFS


@router.get("/resource-survey", response_model=ResourceSurveyConfigOut)
async def get_resource_survey_config(db: AsyncSession = Depends(get_db)):
    return await survey_service.get_resource_survey_config(db)


@router.put("/resource-survey", response_model=ResourceSurveyConfigOut)
async def update_resource_survey_config(
    body: ResourceSurveyConfigUpdate, db: AsyncSession = Depends(get_db)
):
    return await survey_service.set_resource_survey_config(db, body)
