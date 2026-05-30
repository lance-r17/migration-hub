from typing import Any

from pydantic import BaseModel


class GbiNode(BaseModel):
    id: str
    name: str
    children: list["GbiNode"] | None = None


class GbiHierarchy(BaseModel):
    root: GbiNode | None = None


class GbiAssignProjectsRequest(BaseModel):
    gbi_id: str
    project_ids: list[str]


class GbiUnassignProjectsRequest(BaseModel):
    project_ids: list[str]
