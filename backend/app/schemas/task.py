from datetime import datetime

from pydantic import BaseModel, model_validator

from app.models.task import KanbanStatus, Priority


class TagResponse(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str
    color: str = "#6B7280"


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    color: str | None = None
    priority: Priority = Priority.MEDIUM
    status: KanbanStatus = KanbanStatus.TODO
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    repeat_days: list[int] = []  # 0=Mon..6=Sun, empty = one-time
    tag_ids: list[int] = []
    board_id: int | None = None
    tg_remind: bool = False
    tg_remind_at: datetime | None = None

    @model_validator(mode="after")
    def validate_fields(self):
        if self.repeat_days:
            for d in self.repeat_days:
                if not 0 <= d <= 6:
                    raise ValueError("repeat_days must be 0-6 (Mon-Sun)")
        return self


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    color: str | None = None
    priority: Priority | None = None
    status: KanbanStatus | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    repeat_days: list[int] | None = None
    tag_ids: list[int] | None = None
    board_id: int | None = None
    tg_remind: bool | None = None
    tg_remind_at: datetime | None = None

    @model_validator(mode="after")
    def validate_fields(self):
        if self.repeat_days is not None:
            for d in self.repeat_days:
                if not 0 <= d <= 6:
                    raise ValueError("repeat_days must be 0-6 (Mon-Sun)")
        return self


class TaskResponse(BaseModel):
    id: int
    title: str
    color: str
    description: str | None
    priority: Priority
    status: KanbanStatus
    kanban_order: int
    scheduled_start: datetime | None
    scheduled_end: datetime | None
    repeat_days: list[int] | None = None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagResponse]
    board_id: int | None = None
    tg_remind: bool = False
    tg_remind_at: datetime | None = None
    tg_reminded: bool = False

    model_config = {"from_attributes": True}


class KanbanReorder(BaseModel):
    status: KanbanStatus
    ordered_ids: list[int]
