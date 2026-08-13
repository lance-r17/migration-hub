from pydantic import BaseModel, ConfigDict


class CustomNavCardConfig(BaseModel):
    title: str
    description: str
    url: str


class CustomNavCardOut(CustomNavCardConfig):
    model_config = ConfigDict(from_attributes=True)


class CustomNavCardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    url: str | None = None
