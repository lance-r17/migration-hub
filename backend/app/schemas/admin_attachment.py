from pydantic import BaseModel, ConfigDict


class AdminAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    project_name: str
    filename: str
    file_path: str
    status: str
    created_at: str | None = None


class BulkDeleteAttachmentsRequest(BaseModel):
    ids: list[str]


class BulkDeleteAttachmentsResponse(BaseModel):
    deleted: int
    not_found: list[str]
