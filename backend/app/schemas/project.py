from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.approval import ApprovalOut
from app.schemas.cloud_resource import CloudResourceHomeOut, CloudResourceOut
from app.schemas.risk import RiskHomeOut, RiskOut


class TeamMember(BaseModel):
    id: str
    name: str
    avatarUrl: str | None = None
    initials: str | None = None


class GovernanceRoleUser(BaseModel):
    id: str
    name: str
    email: str
    department: str
    initials: str


class GovernanceRolesOut(BaseModel):
    technical_lead: GovernanceRoleUser | None = None
    business_owner: GovernanceRoleUser | None = None
    dba_data_owner: GovernanceRoleUser | None = None
    gbi_champion: GovernanceRoleUser | None = None
    gbi_champion_delegate: GovernanceRoleUser | None = None


class ProjectListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    name: str | None = None
    status: str | None = None
    blocked_reason: str | None = None
    progress: int | None = None
    description: str | None = None
    migration_wave: str | None = None
    itso: str | None = None
    itso_email: str | None = None
    itso_delegate: str | None = None
    itso_delegate_email: str | None = None
    jira_base_url: str | None = None
    updated_at: str | None = None
    wave_id: str | None = None
    jira_story_key: str | None = None
    jira_job_status: str | None = None
    planning: dict[str, Any] | None = None
    survey_submitted_at: datetime | None = None
    is_survey_needed: bool = True
    justification_without_survey: str | None = None
    data_migration_schedule: dict[str, Any] | None = None
    data_migration_plan: dict[str, Any] | None = None
    data_migration_survey_submitted_at: datetime | None = None
    data_migration_survey_submitted_by: str | None = None
    stage_progress: dict[str, int] | None = None
    team: list[dict[str, Any]] | None = None
    migration_constraints: dict[str, Any] | None = None
    migration_effort_estimation: dict[str, Any] | None = None
    application_overview: dict[str, Any] | None = None
    dependencies: dict[str, Any] | None = None
    governance_roles: GovernanceRolesOut | None = None
    availability: dict[str, Any] | None = None
    data_persistence: dict[str, Any] | None = None
    nfrs: dict[str, Any] | None = None
    target_architecture: dict[str, Any] | None = None
    engagement: dict[str, Any] | None = None
    approvals: list[ApprovalOut] | None = None
    cloud_resources: list[CloudResourceOut] | None = None
    resource_sets: list[str] | None = None
    risks: list[RiskOut] | None = None
    bgi_id: str | None = None
    category_milestone_ids: list[str] | None = None


class ProjectDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: str
    blocked_reason: str | None = None
    progress: int
    description: str | None = None
    migration_wave: str | None = None
    itso: str | None = None
    itso_delegate: str | None = None
    jira_base_url: str | None = None
    updated_at: str | None = None
    wave_id: str | None = None
    jira_story_key: str | None = None
    jira_job_status: str | None = None
    planning: dict[str, Any] | None = None
    survey_submitted_at: datetime | None = None
    is_survey_needed: bool = True
    justification_without_survey: str | None = None
    data_migration_schedule: dict[str, Any] | None = None
    data_migration_plan: dict[str, Any] | None = None
    data_migration_survey_submitted_at: datetime | None = None
    data_migration_survey_submitted_by: str | None = None
    stage_progress: dict[str, int] | None = None
    jira_subtask_config: dict[str, Any] | None = None
    migration_effort_estimation: dict[str, Any] | None = None
    team: list[dict[str, Any]] = []
    governance_roles: GovernanceRolesOut | None = None
    application_overview: dict[str, Any] | None = None
    availability: dict[str, Any] | None = None
    data_persistence: dict[str, Any] | None = None
    dependencies: dict[str, Any] | None = None
    nfrs: dict[str, Any] | None = None
    migration_constraints: dict[str, Any] | None = None
    target_architecture: dict[str, Any] | None = None
    engagement: dict[str, Any] | None = None
    cloud_resources: list[CloudResourceOut] = []
    risks: list[RiskOut] = []
    approvals: list[ApprovalOut] = []
    bgi_id: str | None = None
    category_milestone_ids: list[str] | None = None


class ProjectHomeItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    name: str | None = None
    status: str | None = None
    blocked_reason: str | None = None
    progress: int | None = None
    description: str | None = None
    migration_wave: str | None = None
    itso: str | None = None
    itso_delegate: str | None = None
    jira_base_url: str | None = None
    updated_at: str | None = None
    wave_id: str | None = None
    jira_story_key: str | None = None
    jira_job_status: str | None = None
    planning: dict[str, Any] | None = None
    survey_submitted_at: datetime | None = None
    is_survey_needed: bool = True
    justification_without_survey: str | None = None
    data_migration_schedule: dict[str, Any] | None = None
    data_migration_plan: dict[str, Any] | None = None
    data_migration_survey_submitted_at: datetime | None = None
    data_migration_survey_submitted_by: str | None = None
    stage_progress: dict[str, int] | None = None
    team: list[dict[str, Any]] | None = None
    migration_constraints: dict[str, Any] | None = None
    engagement: dict[str, Any] | None = None
    approvals: list[ApprovalOut] | None = None
    cloud_resources: list[CloudResourceHomeOut] | None = None
    risks: list[RiskHomeOut] | None = None
    bgi_id: str | None = None
    category_milestone_ids: list[str] | None = None


class DataMigrationCompleteRequest(BaseModel):
    remark: str | None = None


class DataMigrationReopenRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def _reason_must_be_non_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Reopen reason is required")
        return value


class ProjectCreate(BaseModel):
    id: str | None = None
    name: str
    status: str = "planning"
    description: str | None = None
    wave_id: str | None = None


class ProjectPatch(BaseModel):
    name: str | None = None
    status: str | None = None
    blocked_reason: str | None = None
    description: str | None = None
    migration_wave: str | None = None
    itso: str | None = None
    itso_delegate: str | None = None
    wave_id: str | None = None
    jira_story_key: str | None = None
    jira_job_status: str | None = None
    jira_subtask_config: dict[str, Any] | None = None
    migration_effort_estimation: dict[str, Any] | None = None
    bgi_id: str | None = None


class SurveyNeedPatch(BaseModel):
    is_survey_needed: bool
    justification_without_survey: str | None = None


class SectionPatch(BaseModel):
    value: Any


class PlanningPatch(BaseModel):
    planning: dict[str, Any]


class GovernanceRolesPatch(BaseModel):
    technicalLeadId: str | None = None
    businessOwnerId: str | None = None
    dbaDataOwnerId: str | None = None
    gbiChampionId: str | None = None
    gbiChampionDelegateId: str | None = None
