from datetime import date

from pydantic import BaseModel


class HabitProgress(BaseModel):
    habit_id: int
    name: str
    completion_rate: float
    current_streak: int


class DailyCompletion(BaseModel):
    date: date
    count: int


class StatsResponse(BaseModel):
    active_tasks: int
    completed_last_month: int
    overdue_count: int
    avg_completion_hours: float | None
    productivity_percent: float | None
    most_active_hours: list[int]
    habit_progress: list[HabitProgress]
    daily_completions: list[DailyCompletion]
