from typing import Any

from pydantic import BaseModel


class BgiNode(BaseModel):
    id: str
    name: str
    children: list["BgiNode"] | None = None


class BgiHierarchy(BaseModel):
    root: BgiNode | None = None


class BgiAssignProjectsRequest(BaseModel):
    bgi_id: str
    project_ids: list[str]


class BgiUnassignProjectsRequest(BaseModel):
    project_ids: list[str]
