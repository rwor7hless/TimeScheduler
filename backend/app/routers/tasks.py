import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.board import Board
from app.models.user import User
from app.models.task import KanbanStatus, Priority, Tag, Task, TASK_COLOR_PALETTE
from app.schemas.task import KanbanReorder, TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"], dependencies=[Depends(get_current_user)])


async def _validate_board_ownership(
    board_id: int | None, user_id: int, db: AsyncSession
) -> None:
    if board_id is None:
        return
    result = await db.execute(
        select(Board.id).where(Board.id == board_id, Board.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Board not found")


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: KanbanStatus | None = Query(None, alias="status"),
    priority: Priority | None = None,
    tag: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    board_id: int | None = None,
    default_board: bool = Query(False, description="Filter tasks with board_id IS NULL"),
):
    query = (
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.user_id == current_user.id, Task.is_archived.is_(False))
        .order_by(Task.kanban_order)
    )

    if status_filter:
        query = query.where(Task.status == status_filter)
    if priority:
        query = query.where(Task.priority == priority)
    if date_from:
        query = query.where(Task.scheduled_start >= date_from)
    if date_to:
        query = query.where(Task.scheduled_end <= date_to)
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Task.title.ilike(f"%{escaped}%"))
    if tag:
        query = query.join(Task.tags).where(Tag.name == tag, Tag.user_id == current_user.id)
    if default_board:
        query = query.where(Task.board_id.is_(None))
    elif board_id is not None:
        query = query.where(Task.board_id == board_id)

    result = await db.execute(query)
    return result.scalars().unique().all()


@router.get("/archived", response_model=list[TaskResponse])
async def list_archived_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.user_id == current_user.id, Task.is_archived.is_(True))
        .order_by(Task.completed_at.desc().nullslast(), Task.updated_at.desc())
    )
    return result.scalars().unique().all()


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _validate_board_ownership(data.board_id, current_user.id, db)
    task = Task(
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        color=data.color or random.choice(TASK_COLOR_PALETTE),
        priority=data.priority,
        status=data.status,
        scheduled_start=data.scheduled_start,
        scheduled_end=data.scheduled_end,
        repeat_days=data.repeat_days if data.repeat_days else None,
        board_id=data.board_id,
        tg_remind=data.tg_remind,
        tg_remind_at=data.tg_remind_at,
    )

    if data.tag_ids:
        result = await db.execute(
            select(Tag).where(Tag.id.in_(data.tag_ids), Tag.user_id == current_user.id)
        )
        task.tags = list(result.scalars().all())

    # Set kanban_order to max + 1 for the column
    max_order_result = await db.execute(
        select(Task.kanban_order)
        .where(Task.status == data.status, Task.user_id == current_user.id)
        .order_by(Task.kanban_order.desc())
    )
    max_order = max_order_result.scalar()
    task.kanban_order = (max_order or 0) + 1

    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _validate_board_ownership(data.board_id, current_user.id, db)
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.title = data.title
    task.description = data.description
    if data.color is not None:
        task.color = data.color
    task.priority = data.priority
    task.scheduled_start = data.scheduled_start
    task.scheduled_end = data.scheduled_end
    task.repeat_days = data.repeat_days if data.repeat_days else None
    task.board_id = data.board_id
    task.tg_remind = data.tg_remind
    old_tg_remind_at = task.tg_remind_at
    task.tg_remind_at = data.tg_remind_at
    if data.tg_remind and data.tg_remind_at != old_tg_remind_at:
        task.tg_reminded = False

    if data.status == KanbanStatus.DONE and task.status != KanbanStatus.DONE:
        task.completed_at = datetime.now(timezone.utc)
    elif data.status != KanbanStatus.DONE:
        task.completed_at = None
    task.status = data.status

    if data.tag_ids is not None:
        tag_result = await db.execute(
            select(Tag).where(Tag.id.in_(data.tag_ids), Tag.user_id == current_user.id)
        )
        task.tags = list(tag_result.scalars().all())

    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/reorder", status_code=status.HTTP_200_OK)
async def reorder_tasks(
    data: KanbanReorder,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.ordered_ids:
        return {"ok": True}

    order_mapping = {tid: idx for idx, tid in enumerate(data.ordered_ids)}
    now = datetime.now(timezone.utc)

    await db.execute(
        update(Task)
        .where(Task.id.in_(data.ordered_ids), Task.user_id == current_user.id)
        .values(
            status=data.status,
            kanban_order=case(order_mapping, value=Task.id, else_=Task.kanban_order),
            completed_at=now if data.status == KanbanStatus.DONE else None,
        )
    )
    await db.commit()
    return {"ok": True}


@router.patch("/{task_id}", response_model=TaskResponse)
async def partial_update_task(
    task_id: int,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)
    repeat_days_val = update_data.pop("repeat_days", None)
    if repeat_days_val is not None:
        task.repeat_days = repeat_days_val if repeat_days_val else None

    for field, value in update_data.items():
        setattr(task, field, value)

    if "status" in update_data:
        if update_data["status"] == KanbanStatus.DONE and task.completed_at is None:
            task.completed_at = datetime.now(timezone.utc)
        elif update_data["status"] != KanbanStatus.DONE:
            task.completed_at = None

    if tag_ids is not None:
        tag_result = await db.execute(
            select(Tag).where(Tag.id.in_(tag_ids), Tag.user_id == current_user.id)
        )
        task.tags = list(tag_result.scalars().all())

    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{task_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_archived = True
    if task.completed_at is None:
        task.completed_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{task_id}/unarchive", response_model=TaskResponse)
async def unarchive_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_archived = False
    task.status = KanbanStatus.TODO
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
