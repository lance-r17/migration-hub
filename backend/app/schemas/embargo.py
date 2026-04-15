from pydantic import BaseModel, ConfigDict


class EmbargoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    start_date: str
    end_date: str
    affected_service_lines: list[str] = []
    created_at: str | None = None

    @classmethod
    def from_orm_entry(cls, e: "EmbargoRecord") -> "EmbargoOut":  # noqa: F821
        return cls(
            id=e.id,
            name=e.name,
            start_date=e.start_date,
            end_date=e.end_date,
            affected_service_lines=e.affected_service_lines or [],
            created_at=e.created_at.isoformat() if e.created_at else None,
        )


class EmbargoCreate(BaseModel):
    id: str | None = None
    name: str
    start_date: str
    end_date: str
    affected_service_lines: list[str] = []


class EmbargoUpdate(BaseModel):
    name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    affected_service_lines: list[str] | None = None
