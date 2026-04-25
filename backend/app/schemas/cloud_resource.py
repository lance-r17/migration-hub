from typing import Any

from pydantic import BaseModel, ConfigDict


class CloudResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    resource_id: str | None = None
    name: str
    product: str | None = None
    resource_set: str | None = None
    specs: dict[str, Any] | None = None
    sub_application: str | None = None
    target_resource_id: str | None = None
    sync_status: str
    need_migration: bool = True
    migration_completed: bool = False
    jira_subtask_key: str | None = None


class CloudResourceCreate(BaseModel):
    id: str | None = None
    resource_id: str | None = None
    name: str
    product: str | None = None
    resource_set: str | None = None
    specs: dict[str, Any] | None = None
    sub_application: str | None = None
    target_resource_id: str | None = None
    sync_status: str = "out-of-sync"
    need_migration: bool = True


class CloudResourcePatch(BaseModel):
    resource_id: str | None = None
    name: str | None = None
    product: str | None = None
    resource_set: str | None = None
    specs: dict[str, Any] | None = None
    sub_application: str | None = None
    target_resource_id: str | None = None
    sync_status: str | None = None
    need_migration: bool | None = None
    jira_subtask_key: str | None = None


class ResourceSpecsBatchUpdate(BaseModel):
    updates: list[dict[str, Any]]
