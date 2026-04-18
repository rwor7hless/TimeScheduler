"""
Генерация еженедельного AI-отчёта для пользователя.

Логика сбора данных — здесь.
Промпт (тон, структура, правила) — в weekly_report_prompt.py.
"""
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.board import Board
from app.models.habit import Habit
from app.models.habit_log import HabitLog
from app.models.report import ReportStatus, WeeklyReport
from app.models.task import KanbanStatus, Priority, Task
from app.models.user import User
from app.services.gigachat import chat_completion
from app.services.ntfy import send as ntfy_send
from app.services.weekly_report_prompt import (
    HabitStats,
    ProjectStats,
    TaskEntry,
    WeeklyData,
)
from prompts.weekly_report import build_prompt

logger = logging.getLogger(__name__)

def _strip_intro_heading(text: str) -> str:
    # Оставлено для совместимости с вызовами из reports.py/стримом.
    # Раньше мы срезали заголовок «## Вступление» — теперь это полноценный
    # раздел, срезать не нужно, просто чистим ведущие пустые строки.
    return text.lstrip('\n')


PRIORITY_RU = {
    Priority.LOW: "низкий",
    Priority.MEDIUM: "средний",
    Priority.HIGH: "высокий",
    Priority.URGENT: "срочный",
}

PRIORITY_ORDER = {
    Priority.URGENT: 0,
    Priority.HIGH: 1,
    Priority.MEDIUM: 2,
    Priority.LOW: 3,
}


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _fmt_task(task: Task) -> TaskEntry:
    deadline_str = (
        task.deadline.strftime("%d.%m.%Y") if task.deadline else None
    )
    return TaskEntry(
        title=task.title,
        priority=PRIORITY_RU.get(task.priority, "средний"),
        deadline=deadline_str,
    )


def _sort_by_priority(tasks: list[Task]) -> list[Task]:
    return sorted(tasks, key=lambda t: PRIORITY_ORDER.get(t.priority, 99))


async def _collect_project_stats(
    db: AsyncSession,
    user_id: int,
    ws: datetime,
    we: datetime,
) -> list[ProjectStats]:
    """
    Каждая канбан-доска = отдельный проект.
    Дополнительно собирает задачи без доски в «Без проекта».
    """
    base = (Task.user_id == user_id) & (Task.deleted_at.is_(None)) & (Task.is_archived.is_(False))

    # Список досок пользователя
    boards_result = await db.execute(
        select(Board).where(Board.user_id == user_id).order_by(Board.name)
    )
    boards = boards_result.scalars().all()

    # Добавляем виртуальный «проект без доски»
    board_slots: list[tuple[int | None, str]] = [
        (b.id, b.name) for b in boards
    ] + [(None, "Без проекта")]

    projects: list[ProjectStats] = []

    for board_id, board_name in board_slots:
        board_cond = (
            Task.board_id == board_id
            if board_id is not None
            else Task.board_id.is_(None)
        )

        # Выполненные на этой неделе
        done_rows = (
            await db.execute(
                select(Task).where(
                    base,
                    board_cond,
                    Task.status == KanbanStatus.DONE,
                    Task.completed_at >= ws,
                    Task.completed_at <= we,
                )
            )
        ).scalars().all()

        # Просроченные (дедлайн прошёл, ещё не выполнены)
        overdue_rows = (
            await db.execute(
                select(Task).where(
                    base,
                    board_cond,
                    Task.status != KanbanStatus.DONE,
                    Task.deadline.isnot(None),
                    Task.deadline < we,
                )
            )
        ).scalars().all()

        # В работе прямо сейчас
        in_progress_rows = (
            await db.execute(
                select(Task).where(
                    base,
                    board_cond,
                    Task.status == KanbanStatus.IN_PROGRESS,
                )
            )
        ).scalars().all()

        # Задачи в очереди (TODO) — только количество, чтобы не раздувать промпт
        todo_count: int = (
            await db.execute(
                select(func.count(Task.id)).where(
                    base,
                    board_cond,
                    Task.status == KanbanStatus.TODO,
                )
            )
        ).scalar() or 0

        # Пропускаем полностью пустые проекты
        if not done_rows and not overdue_rows and not in_progress_rows and todo_count == 0:
            continue

        projects.append(
            ProjectStats(
                name=board_name,
                done_tasks=[_fmt_task(t) for t in _sort_by_priority(done_rows)],
                overdue_tasks=[_fmt_task(t) for t in _sort_by_priority(overdue_rows)],
                in_progress_tasks=[_fmt_task(t) for t in _sort_by_priority(in_progress_rows)],
                todo_count=todo_count,
            )
        )

    return projects


async def _collect_habit_stats(
    db: AsyncSession,
    user_id: int,
    week_start: date,
    week_end: date,
) -> list[HabitStats]:
    habits_result = await db.execute(
        select(Habit).where(Habit.user_id == user_id, Habit.is_active.is_(True))
    )
    habits = habits_result.scalars().all()

    result: list[HabitStats] = []
    for habit in habits:
        count = (
            await db.execute(
                select(func.count(HabitLog.id)).where(
                    HabitLog.habit_id == habit.id,
                    HabitLog.date >= week_start,
                    HabitLog.date <= week_end,
                )
            )
        ).scalar() or 0
        result.append(HabitStats(name=habit.name, done_days=count))

    # Сортируем: сначала провалы, чтобы они были на виду в промпте
    result.sort(key=lambda h: h.pct)
    return result


async def build_weekly_data(
    db: AsyncSession,
    user_id: int,
    week_start: date,
) -> WeeklyData:
    week_end = week_start + timedelta(days=6)
    ws = datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc)
    we = datetime(week_end.year, week_end.month, week_end.day, 23, 59, 59, tzinfo=timezone.utc)

    projects = await _collect_project_stats(db, user_id, ws, we)
    habits = await _collect_habit_stats(db, user_id, week_start, week_end)

    return WeeklyData(
        week_start=week_start.strftime("%d.%m.%Y"),
        week_end=week_end.strftime("%d.%m.%Y"),
        projects=projects,
        habits=habits,
    )


async def generate_report_for_user(user_id: int, week_start: date) -> None:
    """Генерирует отчёт и сохраняет результат в БД."""
    async with async_session() as db:
        result = await db.execute(
            select(WeeklyReport).where(
                WeeklyReport.user_id == user_id,
                WeeklyReport.week_start == week_start,
            )
        )
        report = result.scalar_one_or_none()
        if not report:
            report = WeeklyReport(
                user_id=user_id,
                week_start=week_start,
                status=ReportStatus.PENDING,
            )
            db.add(report)
            await db.flush()

        try:
            data = await build_weekly_data(db, user_id, week_start)
            messages = build_prompt(data)
            content = await chat_completion(messages)
            report.status = ReportStatus.DONE
            report.content = _strip_intro_heading(content)
            report.error_msg = None
            logger.info(f"Weekly report generated for user_id={user_id}, week={week_start}")
            await ntfy_send(
                title="Недельный отчёт готов",
                message=f"AI разобрал твою неделю {week_start.strftime('%d.%m')} — загляни в уведомления.",
                tags=["bar_chart"],
                priority="default",
            )
        except Exception as e:
            report.status = ReportStatus.ERROR
            report.error_msg = str(e)[:500]
            logger.exception("Weekly report failed for user_id=%s", user_id)

        await db.commit()


async def run_weekly_reports() -> None:
    """Запускается по крону — генерирует отчёты для всех пользователей."""
    week_start = _monday_of(date.today())
    async with async_session() as db:
        users_result = await db.execute(select(User))
        users = users_result.scalars().all()

    logger.info(f"Starting weekly reports for {len(users)} users, week={week_start}")
    for user in users:
        await generate_report_for_user(user.id, week_start)
