from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import NamedTuple

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.board import Board
from app.models.habit import Habit
from app.models.habit_log import HabitLog
from app.models.task import KanbanStatus, Tag, Task, task_tags
from app.schemas.stats import (
    BreakdownItem,
    DailyCompletion,
    HabitProgress,
    PreviousPeriodMetrics,
    StatsResponse,
)

PRIORITY_LABELS = {"low": "Низкий", "medium": "Средний", "high": "Высокий", "urgent": "Срочный"}
PRIORITY_COLORS = {"low": "#9CA3AF", "medium": "#3B82F6", "high": "#F59E0B", "urgent": "#EF4444"}


class _Window(NamedTuple):
    start: datetime  # inclusive
    end: datetime    # exclusive
    days: int        # span in whole days


def _window_for_week(week_start: date) -> _Window:
    start = datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc)
    return _Window(start=start, end=start + timedelta(days=7), days=7)


def _window_for_period(period_days: int) -> _Window:
    now = datetime.now(timezone.utc)
    return _Window(start=now - timedelta(days=period_days), end=now, days=period_days)


async def _compute_prev_metrics(
    db: AsyncSession, user_id: int, *, prev_week_start: date
) -> PreviousPeriodMetrics:
    """Minimal metrics for the previous week — used for delta badges on the hero band."""
    win = _window_for_week(prev_week_start)
    task_filter = (Task.user_id == user_id) & (Task.deleted_at.is_(None))

    completed = (await db.execute(
        select(func.count(Task.id)).where(
            task_filter,
            Task.status == KanbanStatus.DONE,
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
        )
    )).scalar() or 0

    created = (await db.execute(
        select(func.count(Task.id)).where(
            task_filter,
            Task.created_at >= win.start,
            Task.created_at < win.end,
        )
    )).scalar() or 0

    productivity = round(completed / created * 100, 1) if created > 0 else None

    active_days_row = (await db.execute(
        select(func.count(func.distinct(func.date(Task.completed_at)))).where(
            task_filter,
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
        )
    )).scalar() or 0

    # Average habit completion % across all active habits for prev window.
    habits = (await db.execute(
        select(Habit).where(Habit.user_id == user_id, Habit.is_active.is_(True))
    )).scalars().all()

    if habits:
        total_pct = 0.0
        for habit in habits:
            log_count = (await db.execute(
                select(func.count(HabitLog.id)).where(
                    and_(
                        HabitLog.habit_id == habit.id,
                        HabitLog.date >= prev_week_start,
                        HabitLog.date < prev_week_start + timedelta(days=7),
                    )
                )
            )).scalar() or 0
            total_pct += log_count / 7
        habits_done_pct = round(total_pct / len(habits) * 100, 1)
    else:
        habits_done_pct = None

    return PreviousPeriodMetrics(
        completed_count=completed,
        productivity_percent=productivity,
        active_days=active_days_row,
        habits_done_pct=habits_done_pct,
    )


async def get_stats(
    db: AsyncSession,
    user_id: int,
    period_days: int = 30,
    *,
    week_start: date | None = None,
) -> StatsResponse:
    """
    Collect all stats for a window.

    Two modes:
      1. period_days (default) — trailing window ending now. Used by Month/Year tabs.
      2. week_start (if set)   — fixed Monday..Sunday window. Enables navigating past weeks
                                 and triggers the previous_period_metrics computation used
                                 for delta badges in the Week-mode hero band.
    """
    if week_start is not None:
        win = _window_for_week(week_start)
    else:
        win = _window_for_period(period_days)

    task_filter = (Task.user_id == user_id) & (Task.deleted_at.is_(None))

    # Active tasks (not done, not archived) — a running total, not window-scoped.
    active_result = await db.execute(
        select(func.count(Task.id)).where(
            task_filter, Task.status != KanbanStatus.DONE, Task.is_archived.is_(False)
        )
    )
    active_tasks = active_result.scalar() or 0

    # Completed in window
    completed_result = await db.execute(
        select(func.count(Task.id)).where(
            task_filter,
            Task.status == KanbanStatus.DONE,
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
        )
    )
    completed_last_month = completed_result.scalar() or 0

    # Overdue tasks — snapshot against "now", not window end, because overdue is present-tense.
    now = datetime.now(timezone.utc)
    overdue_result = await db.execute(
        select(func.count(Task.id)).where(
            task_filter,
            Task.status != KanbanStatus.DONE,
            Task.is_archived.is_(False),
            Task.deadline < now,
            Task.deadline.isnot(None),
        )
    )
    overdue_count = overdue_result.scalar() or 0

    # Average completion time
    avg_result = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Task.completed_at) - func.extract("epoch", Task.created_at)
            )
        ).where(
            task_filter,
            Task.completed_at.isnot(None),
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
        )
    )
    avg_seconds = avg_result.scalar()
    avg_completion_hours = round(avg_seconds / 3600, 1) if avg_seconds else None

    # Productivity = completed_in_window / created_in_window
    total_created_result = await db.execute(
        select(func.count(Task.id)).where(
            task_filter, Task.created_at >= win.start, Task.created_at < win.end
        )
    )
    total_created = total_created_result.scalar() or 0
    productivity_percent = (
        round(completed_last_month / total_created * 100, 1) if total_created > 0 else None
    )

    # Most active hours
    completed_tasks_result = await db.execute(
        select(Task.completed_at).where(
            task_filter,
            Task.completed_at.isnot(None),
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
        )
    )
    hours = [row[0].hour for row in completed_tasks_result.all()]
    hour_counts = Counter(hours)
    most_active_hours = [h for h, _ in hour_counts.most_common(4)] if hour_counts else []

    # Daily completions
    daily_result = await db.execute(
        select(
            func.date(Task.completed_at).label("day"),
            func.count(Task.id).label("cnt"),
        )
        .where(
            task_filter,
            Task.completed_at.isnot(None),
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
        )
        .group_by(func.date(Task.completed_at))
        .order_by(func.date(Task.completed_at))
    )
    daily_completions = [
        DailyCompletion(date=row.day, count=row.cnt) for row in daily_result.all()
    ]

    # === Breakdowns ===

    priority_result = await db.execute(
        select(Task.priority, func.count(Task.id))
        .where(
            task_filter,
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
            Task.completed_at.isnot(None),
        )
        .group_by(Task.priority)
    )
    by_priority = [
        BreakdownItem(
            label=PRIORITY_LABELS.get(row[0].value, row[0].value),
            count=row[1],
            color=PRIORITY_COLORS.get(row[0].value),
        )
        for row in priority_result.all()
    ]

    board_result = await db.execute(
        select(Board.name, func.count(Task.id))
        .outerjoin(Board, Task.board_id == Board.id)
        .where(
            task_filter,
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
            Task.completed_at.isnot(None),
        )
        .group_by(Board.name)
    )
    by_board = [
        BreakdownItem(label=row[0] or "Основная", count=row[1])
        for row in board_result.all()
    ]

    tag_result = await db.execute(
        select(Tag.name, Tag.color, func.count(Task.id))
        .join(task_tags, task_tags.c.task_id == Task.id)
        .join(Tag, Tag.id == task_tags.c.tag_id)
        .where(
            task_filter,
            Task.completed_at >= win.start,
            Task.completed_at < win.end,
            Task.completed_at.isnot(None),
        )
        .group_by(Tag.name, Tag.color)
    )
    by_tag = [
        BreakdownItem(label=row[0], count=row[2], color=row[1])
        for row in tag_result.all()
    ]

    # === Habits — per-day flags for the window + rate + streak ===

    habits_result = await db.execute(
        select(Habit).where(Habit.user_id == user_id, Habit.is_active.is_(True))
    )
    habits = habits_result.scalars().all()
    habit_progress: list[HabitProgress] = []
    today = date.today()
    window_start_date = win.start.date()

    for habit in habits:
        # Pull all logs in the window once — used for both rate and days flags.
        window_logs_result = await db.execute(
            select(HabitLog.date).where(
                and_(
                    HabitLog.habit_id == habit.id,
                    HabitLog.date >= window_start_date,
                    HabitLog.date < win.end.date(),
                )
            )
        )
        window_dates = {row[0] for row in window_logs_result.all()}
        log_count = len(window_dates)
        completion_rate = round(log_count / win.days, 2) if win.days else 0.0

        days_flags: list[bool] = [
            (window_start_date + timedelta(days=i)) in window_dates
            for i in range(win.days)
        ]

        # Streak still looks back from today, independent of the window.
        streak_logs_result = await db.execute(
            select(HabitLog.date).where(
                and_(
                    HabitLog.habit_id == habit.id,
                    HabitLog.date >= today - timedelta(days=365),
                    HabitLog.date <= today,
                )
            )
        )
        logged_dates = {row[0] for row in streak_logs_result.all()}
        streak = 0
        check_date = today
        while check_date in logged_dates:
            streak += 1
            check_date -= timedelta(days=1)

        habit_progress.append(
            HabitProgress(
                habit_id=habit.id,
                name=habit.name,
                completion_rate=completion_rate,
                current_streak=streak,
                days=days_flags,
            )
        )

    # Previous-week metrics — only in week mode.
    previous_period_metrics: PreviousPeriodMetrics | None = None
    if week_start is not None:
        previous_period_metrics = await _compute_prev_metrics(
            db, user_id, prev_week_start=week_start - timedelta(days=7)
        )

    return StatsResponse(
        active_tasks=active_tasks,
        completed_last_month=completed_last_month,
        overdue_count=overdue_count,
        avg_completion_hours=avg_completion_hours,
        productivity_percent=productivity_percent,
        most_active_hours=most_active_hours,
        habit_progress=habit_progress,
        daily_completions=daily_completions,
        by_priority=by_priority,
        by_board=by_board,
        by_tag=by_tag,
        week_start=week_start,
        previous_period_metrics=previous_period_metrics,
    )
