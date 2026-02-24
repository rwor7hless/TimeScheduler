from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.habit import Habit
from app.models.user import User
from app.models.habit_log import HabitLog
from app.schemas.habit import (
    HabitCreate,
    HabitLogResponse,
    HabitLogToggle,
    HabitResponse,
    HabitUpdate,
)

router = APIRouter(prefix="/api/habits", tags=["habits"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[HabitResponse])
async def list_habits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Habit)
        .options(selectinload(Habit.logs))
        .where(Habit.user_id == current_user.id)
        .order_by(Habit.created_at)
    )
    return result.scalars().unique().all()


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
    data: HabitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = Habit(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        color=data.color,
    )
    db.add(habit)
    await db.commit()
    await db.refresh(habit)
    return habit


@router.put("/{habit_id}", response_model=HabitResponse)
async def update_habit(
    habit_id: int,
    data: HabitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Habit)
        .options(selectinload(Habit.logs))
        .where(Habit.id == habit_id, Habit.user_id == current_user.id)
    )
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(habit, field, value)

    await db.commit()
    await db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Habit).where(Habit.id == habit_id, Habit.user_id == current_user.id)
    )
    habit = result.scalar_one_or_none()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    await db.delete(habit)
    await db.commit()


@router.post("/{habit_id}/log", response_model=HabitLogResponse | None)
async def toggle_habit_log(
    habit_id: int,
    data: HabitLogToggle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check habit exists and belongs to user
    habit_result = await db.execute(
        select(Habit).where(Habit.id == habit_id, Habit.user_id == current_user.id)
    )
    if not habit_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Habit not found")

    # Check if log exists for this date
    result = await db.execute(
        select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.date == data.date)
    )
    existing_log = result.scalar_one_or_none()

    if existing_log:
        await db.delete(existing_log)
        await db.commit()
        return None
    else:
        log = HabitLog(habit_id=habit_id, date=data.date, completed_at=datetime.now(timezone.utc))
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log


@router.get("/{habit_id}/logs", response_model=list[HabitLogResponse])
async def get_habit_logs(
    habit_id: int,
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(HabitLog)
        .join(Habit)
        .where(HabitLog.habit_id == habit_id, Habit.user_id == current_user.id)
        .order_by(HabitLog.date)
    )
    if from_date:
        query = query.where(HabitLog.date >= from_date)
    if to_date:
        query = query.where(HabitLog.date <= to_date)

    result = await db.execute(query)
    return result.scalars().all()
