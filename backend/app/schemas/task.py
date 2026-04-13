from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.task import KanbanStatus, Priority

COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class TagResponse(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str
    color: str = Field(default="#6B7280", pattern=COLOR_PATTERN)


class TaskCreate(BaseModel):
    title: str = Field(max_length=255)
    description: str | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    priority: Priority = Priority.MEDIUM
    status: KanbanStatus = KanbanStatus.TODO
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    deadline: datetime | None = None
    repeat_days: list[int] = []  # 0=Mon..6=Sun, empty = one-time
    tag_ids: list[int] = []
    board_id: int | None = None
    parent_id: int | None = None
    tg_remind: bool = False
    tg_remind_at: datetime | None = None
    my_day: bool = False

    @model_validator(mode="after")
    def validate_fields(self):
        if self.repeat_days:
            for d in self.repeat_days:
                if not 0 <= d <= 6:
                    raise ValueError("repeat_days must be 0-6 (Mon-Sun)")
        if self.scheduled_start and self.scheduled_end:
            if self.scheduled_start > self.scheduled_end:
                raise ValueError("scheduled_start must be before or equal to scheduled_end")
        return self


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    priority: Priority | None = None
    status: KanbanStatus | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    deadline: datetime | None = None
    repeat_days: list[int] | None = None
    tag_ids: list[int] | None = None
    board_id: int | None = None
    parent_id: int | None = None
    tg_remind: bool | None = None
    tg_remind_at: datetime | None = None
    my_day: bool | None = None

    @model_validator(mode="after")
    def validate_fields(self):
        if self.repeat_days is not None:
            for d in self.repeat_days:
                if not 0 <= d <= 6:
                    raise ValueError("repeat_days must be 0-6 (Mon-Sun)")
        if self.scheduled_start and self.scheduled_end:
            if self.scheduled_start > self.scheduled_end:
                raise ValueError("scheduled_start must be before or equal to scheduled_end")
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
    deadline: datetime | None = None
    repeat_days: list[int] | None = None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagResponse]
    board_id: int | None = None
    parent_id: int | None = None
    is_archived: bool = False
    tg_remind: bool = False
    tg_remind_at: datetime | None = None
    tg_reminded: bool = False
    my_day: bool = False
    subtasks: list["TaskResponse"] = []

    model_config = {"from_attributes": True}


class KanbanReorder(BaseModel):
    status: KanbanStatus
    ordered_ids: list[int]
