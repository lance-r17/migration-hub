from typing import Any

from pydantic import BaseModel


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
