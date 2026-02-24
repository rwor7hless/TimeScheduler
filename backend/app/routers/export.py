import csv
import io
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskResponse
from app.services.stats import get_stats

router = APIRouter(prefix="/api/export", tags=["export"], dependencies=[Depends(get_current_user)])


@router.get("/tasks")
async def export_tasks(
    format: str = Query("json", pattern="^(csv|json)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.tags))
        .where(Task.user_id == current_user.id)
        .order_by(Task.created_at)
    )
    tasks = result.scalars().unique().all()

    task_dicts = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description or "",
            "priority": t.priority.value,
            "status": t.status.value,
            "scheduled_start": t.scheduled_start.isoformat() if t.scheduled_start else "",
            "scheduled_end": t.scheduled_end.isoformat() if t.scheduled_end else "",
            "repeat_days": t.repeat_days or [],
            "completed_at": t.completed_at.isoformat() if t.completed_at else "",
            "created_at": t.created_at.isoformat(),
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
