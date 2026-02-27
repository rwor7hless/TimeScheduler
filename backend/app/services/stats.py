from collections import Counter
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit
from app.models.habit_log import HabitLog
from app.models.task import KanbanStatus, Task
from app.schemas.stats import DailyCompletion, HabitProgress, StatsResponse


async def get_stats(db: AsyncSession, user_id: int, period_days: int = 30) -> StatsResponse:
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=period_days)

    task_filter = Task.user_id == user_id

    # Active tasks (not done)
    active_result = await db.execute(
        select(func.count(Task.id)).where(task_filter, Task.status != KanbanStatus.DONE)
    )
    active_tasks = active_result.scalar() or 0

    # Completed last month
    completed_result = await db.execute(
        select(func.count(Task.id)).where(
            task_filter,
            Task.status == KanbanStatus.DONE,
            Task.completed_at >= period_start,
        )
    )
    completed_last_month = completed_result.scalar() or 0

    # Overdue tasks (explicit deadline in the past and not done)
    overdue_result = await db.execute(
        select(func.count(Task.id)).where(
            task_filter,
            Task.status != KanbanStatus.DONE,
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
            Task.completed_at >= period_start,
        )
    )
    avg_seconds = avg_result.scalar()
    avg_completion_hours = round(avg_seconds / 3600, 1) if avg_seconds else None

    # Productivity: completed / total created in period
    total_created_result = await db.execute(
        select(func.count(Task.id)).where(task_filter, Task.created_at >= period_start)
    )
    total_created = total_created_result.scalar() or 0
    productivity_percent = (
        round(completed_last_month / total_created * 100, 1) if total_created > 0 else None
    )

    # Most active hours (based on completed_at)
    completed_tasks_result = await db.execute(
        select(Task.completed_at).where(
            task_filter,
            Task.completed_at.isnot(None),
            Task.completed_at >= period_start,
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
            Task.completed_at >= period_start,
        )
        .group_by(func.date(Task.completed_at))
        .order_by(func.date(Task.completed_at))
    )
    daily_completions = [
        DailyCompletion(date=row.day, count=row.cnt) for row in daily_result.all()
    ]

    # Habit progress
    habits_result = await db.execute(
        select(Habit).where(Habit.user_id == user_id, Habit.is_active.is_(True))
    )
    habits = habits_result.scalars().all()
    habit_progress = []

    for habit in habits:
        logs_result = await db.execute(
            select(func.count(HabitLog.id)).where(
                and_(HabitLog.habit_id == habit.id, HabitLog.date >= period_start.date())
            )
        )
        log_count = logs_result.scalar() or 0
        completion_rate = round(log_count / period_days, 2)

        # Calculate streak
        streak = 0
        today = date.today()
        check_date = today
        while True:
            log_exists = await db.execute(
                select(HabitLog.id).where(
                    and_(HabitLog.habit_id == habit.id, HabitLog.date == check_date)
                )
            )
            if log_exists.scalar_one_or_none():
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break

        habit_progress.append(
            HabitProgress(
                habit_id=habit.id,
                name=habit.name,
                completion_rate=completion_rate,
                current_streak=streak,
            )
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
    )
