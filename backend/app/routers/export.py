import csv
import io
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.task import KanbanStatus, Priority, Tag, Task
from app.models.user import User
from app.services.stats import get_stats

router = APIRouter(prefix="/api/export", tags=["export"], dependencies=[Depends(get_current_user)])


@router.get("/tasks")
async def export_tasks(
    format: str = Query("json", pattern="^(csv|json)$"),
    priority: Priority | None = None,
    status: KanbanStatus | None = None,
    board_id: int | None = None,
    tag: str | None = None,
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.user_id == current_user.id, Task.deleted_at.is_(None))
    )

    if not include_archived:
        query = query.where(Task.is_archived.is_(False))
    if priority:
        query = query.where(Task.priority == priority)
    if status:
        query = query.where(Task.status == status)
    if board_id is not None:
        query = query.where(Task.board_id == board_id)
    if tag:
        query = query.join(Task.tags).where(Tag.name == tag, Tag.user_id == current_user.id)

    query = query.order_by(Task.created_at)
    result = await db.execute(query)
    tasks = result.scalars().unique().all()

    task_dicts = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description or "",
            "priority": t.priority.value,
            "status": t.status.value,
            "board_id": t.board_id,
            "scheduled_start": t.scheduled_start.isoformat() if t.scheduled_start else "",
            "scheduled_end": t.scheduled_end.isoformat() if t.scheduled_end else "",
            "deadline": t.deadline.isoformat() if t.deadline else "",
            "repeat_days": t.repeat_days or [],
            "completed_at": t.completed_at.isoformat() if t.completed_at else "",
            "created_at": t.created_at.isoformat(),
            "is_archived": t.is_archived,
            "tags": ", ".join(tag.name for tag in t.tags),
        }
        for t in tasks
    ]

    if format == "json":
        content = json.dumps(task_dicts, indent=2, ensure_ascii=False)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=tasks.json"},
        )

    output = io.StringIO()
    if task_dicts:
        writer = csv.DictWriter(output, fieldnames=task_dicts[0].keys())
        writer.writeheader()
        writer.writerows(task_dicts)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks.csv"},
    )


@router.get("/stats")
async def export_stats(
    format: str = Query("json", pattern="^(csv|json)$"),
    period: str = Query("month", pattern="^(week|month|year)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period_days = {"week": 7, "month": 30, "year": 365}[period]
    stats = await get_stats(db, current_user.id, period_days)
    stats_dict = stats.model_dump()

    if format == "json":
        content = json.dumps(stats_dict, indent=2, default=str, ensure_ascii=False)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=stats.json"},
        )

    # Flatten for CSV
    flat = {
        "active_tasks": stats_dict["active_tasks"],
        "completed_last_month": stats_dict["completed_last_month"],
        "overdue_count": stats_dict["overdue_count"],
        "avg_completion_hours": stats_dict["avg_completion_hours"],
        "productivity_percent": stats_dict["productivity_percent"],
        "most_active_hours": ", ".join(str(h) for h in stats_dict["most_active_hours"]),
    }
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=flat.keys())
    writer.writeheader()
    writer.writerow(flat)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stats.csv"},
    )
