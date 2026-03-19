from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.task import Task, Tag
from app.models.habit import Habit
from app.models.board import Board
from app.models.user import User

router = APIRouter(prefix="/api/search", tags=["search"], dependencies=[Depends(get_current_user)])


class SearchResult(BaseModel):
    tasks: list[dict]
    habits: list[dict]
    boards: list[dict]


@router.get("", response_model=SearchResult)
async def global_search(
    q: str = Query(min_length=1, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"

    # Search tasks
    task_result = await db.execute(
        select(Task)
        .options(selectinload(Task.tags))
        .where(
            Task.user_id == current_user.id,
            Task.title.ilike(pattern),
            Task.is_archived.is_(False),
            Task.parent_id.is_(None),
            Task.deleted_at.is_(None),
        )
        .order_by(Task.updated_at.desc())
        .limit(20)
    )
    tasks = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status.value,
            "priority": t.priority.value,
            "color": t.color,
            "board_id": t.board_id,
            "type": "task",
        }
        for t in task_result.scalars().unique().all()
    ]

    # Search habits
    habit_result = await db.execute(
        select(Habit)
        .where(Habit.user_id == current_user.id, Habit.name.ilike(pattern))
        .limit(10)
    )
    habits = [
        {
            "id": h.id,
            "name": h.name,
            "color": h.color,
            "is_active": h.is_active,
            "type": "habit",
        }
        for h in habit_result.scalars().all()
    ]

    # Search boards
    board_result = await db.execute(
        select(Board)
        .where(Board.user_id == current_user.id, Board.name.ilike(pattern))
        .limit(10)
    )
    boards = [
        {"id": b.id, "name": b.name, "type": "board"}
        for b in board_result.scalars().all()
    ]

    return SearchResult(tasks=tasks, habits=habits, boards=boards)
