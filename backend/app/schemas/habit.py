from datetime import date, datetime

from pydantic import BaseModel, Field

COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class HabitCreate(BaseModel):
    name: str = Field(max_length=255)
    description: str | None = None
    color: str = Field(default="#10B981", pattern=COLOR_PATTERN)


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    is_active: bool | None = None


class HabitLogToggle(BaseModel):
    date: date


class HabitLogResponse(BaseModel):
    id: int
    habit_id: int
    date: date
    completed_at: datetime

    model_config = {"from_attributes": True}


class HabitResponse(BaseModel):
    id: int
    name: str
    description: str | None
    color: str
    is_active: bool
    created_at: datetime
    logs: list[HabitLogResponse] = []

    model_config = {"from_attributes": True}
