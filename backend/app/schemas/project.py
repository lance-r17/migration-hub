from typing import Any

from pydantic import BaseModel, ConfigDict

from app.schemas.approval import ApprovalOut
from app.schemas.cloud_resource import CloudResourceOut
from app.schemas.risk import RiskOut


class TeamMember(BaseModel):
    id: str
    name: str
    avatarUrl: str | None = None
    initials: str | None = None


class ProjectListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: str
    progress: int
    description: str | None = None
    migration_wave: str | None = None
    profile_owner: str | None = None
    jira_ticket: str | None = None
    jira_base_url: str | None = None
    last_updated: str | None = None
    wave_id: str | None = None
    jira_story_key: str | None = None
    jira_job_status: str | None = None
    planning: dict[str, Any] | None = None
    team: list[dict[str, Any]] = []
    migration_constraints: dict[str, Any] | None = None
    approvals: list[ApprovalOut] = []
    cloud_resources: list[CloudResourceOut] = []


class ProjectDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: str
    progress: int
    description: str | None = None
    migration_wave: str | None = None
    profile_owner: str | None = None
    jira_ticket: str | None = None
    jira_base_url: str | None = None
    last_updated: str | None = None
    wave_id: str | None = None
    jira_story_key: str | None = None
    jira_job_status: str | None = None
    planning: dict[str, Any] | None = None
    jira_subtask_config: dict[str, Any] | None = None
    team: list[dict[str, Any]] = []
    application_overview: dict[str, Any] | None = None
    availability: dict[str, Any] | None = None
    data_persistence: dict[str, Any] | None = None
    dependencies: dict[str, Any] | None = None
    nfrs: dict[str, Any] | None = None
    migration_constraints: dict[str, Any] | None = None
    target_architecture: dict[str, Any] | None = None
    cloud_resources: list[CloudResourceOut] = []
    risks: list[RiskOut] = []
    approvals: list[ApprovalOut] = []


class ProjectCreate(BaseModel):
    id: str | None = None
    name: str
    status: str = "planning"
    progress: int = 0
    description: str | None = None
    wave_id: str | None = None


class ProjectPatch(BaseModel):
    name: str | None = None
    status: str | None = None
    progress: int | None = None
    description: str | None = None
    migration_wave: str | None = None
    profile_owner: str | None = None
    jira_ticket: str | None = None
    jira_base_url: str | None = None
    last_updated: str | None = None
    wave_id: str | None = None
    jira_story_key: str | None = None
    jira_job_status: str | None = None
    jira_subtask_config: dict[str, Any] | None = None


class SectionPatch(BaseModel):
    value: Any


class PlanningPatch(BaseModel):
    planning: dict[str, Any]
