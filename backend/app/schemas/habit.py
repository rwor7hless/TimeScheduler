from datetime import date, datetime

from pydantic import BaseModel


class HabitCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#10B981"


class HabitUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
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
