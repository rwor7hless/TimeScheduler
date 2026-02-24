from datetime import datetime

from pydantic import BaseModel


class BoardBase(BaseModel):
    name: str


class BoardCreate(BoardBase):
    pass


class BoardUpdate(BaseModel):
    name: str | None = None


class BoardResponse(BoardBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

