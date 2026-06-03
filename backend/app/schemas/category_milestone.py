from pydantic import BaseModel, ConfigDict


class CategoryMilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    start_date: str
    end_date: str
    color: str | None = None
    icon: str | None = None
    created_at: str | None = None

    @classmethod
    def from_orm_entry(cls, cm: "CategoryMilestone") -> "CategoryMilestoneOut":  # noqa: F821
        return cls(
            id=cm.id,
            name=cm.name,
            start_date=cm.start_date,
            end_date=cm.end_date,
            color=cm.color,
            icon=cm.icon,
            created_at=cm.created_at.isoformat() if cm.created_at else None,
        )


class CategoryMilestoneCreate(BaseModel):
    id: str | None = None
    name: str
    start_date: str
    end_date: str
    color: str | None = None
    icon: str | None = None


class CategoryMilestoneUpdate(BaseModel):
    name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    color: str | None = None
    icon: str | None = None


class CategoryMilestoneBatchAssign(BaseModel):
    category_milestone_id: str
    project_ids: list[str]
    unassign: bool = False
