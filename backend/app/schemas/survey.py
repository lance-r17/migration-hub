from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SurveyConfigOut(BaseModel):
    is_active: bool = False
    questions: list[dict[str, Any]] = []
    updated_by: str = ""
    updated_at: str = ""


class SurveyConfigUpdate(BaseModel):
    is_active: bool | None = None
    questions: list[dict[str, Any]] | None = None
    updated_by: str | None = None
    updated_at: str | None = None


class ResourceSurveyConfigOut(BaseModel):
    groups: list[dict[str, Any]] = []
    updated_by: str = ""
    updated_at: str = ""


class ResourceSurveyConfigUpdate(BaseModel):
    groups: list[dict[str, Any]] | None = None
    updated_by: str | None = None
    updated_at: str | None = None


class SurveyDraftPayload(BaseModel):
    current_index: int = 0
    answers: dict[str, Any] = Field(default_factory=dict)
    attachment_answers: dict[str, list[str]] = Field(default_factory=dict)
    removed_attachment_ids: list[str] = Field(default_factory=list)
    resource_answers: dict[str, dict[str, Any]] = Field(default_factory=dict)


class SurveyDraftSave(BaseModel):
    payload: SurveyDraftPayload


class SurveyDraftOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: str
    project_id: str
    payload: dict[str, Any]
    updated_at: datetime
