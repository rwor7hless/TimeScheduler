from datetime import datetime

from pydantic import BaseModel


class NoteCreate(BaseModel):
    title: str = ""
    content: str = ""
    task_id: int | None = None


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    task_id: int | None = None


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    task_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
