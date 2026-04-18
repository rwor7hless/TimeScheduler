from datetime import date

from pydantic import BaseModel


class HabitProgress(BaseModel):
    habit_id: int
    name: str
    completion_rate: float
    current_streak: int
    # Per-day completion flags for the requested window.
    # Length = 7 when week_start is set, period_days otherwise.
    # Order: chronological (oldest → newest). For week_start, Mon..Sun.
    days: list[bool] = []


class DailyCompletion(BaseModel):
    date: date
    count: int


class BreakdownItem(BaseModel):
    label: str
    count: int
    color: str | None = None


class PreviousPeriodMetrics(BaseModel):
    """Sparse metrics for the previous period of the same length.
    Populated only when the caller explicitly requests a specific week."""
    completed_count: int
    productivity_percent: float | None
    active_days: int
    habits_done_pct: float | None


class StatsResponse(BaseModel):
    active_tasks: int
    completed_last_month: int
    overdue_count: int
    avg_completion_hours: float | None
    productivity_percent: float | None
    most_active_hours: list[int]
    habit_progress: list[HabitProgress]
    daily_completions: list[DailyCompletion]
    by_priority: list[BreakdownItem]
    by_board: list[BreakdownItem]
    by_tag: list[BreakdownItem]
    # Echoed back so the frontend trusts the server-computed Monday, not its local tz.
    week_start: date | None = None
    previous_period_metrics: PreviousPeriodMetrics | None = None
