from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.stats import StatsResponse
from app.services.stats import get_stats

router = APIRouter(prefix="/api/stats", tags=["stats"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=StatsResponse)
async def stats(
    period: str = Query("month", pattern="^(week|month|year)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period_days = {"week": 7, "month": 30, "year": 365}[period]
    return await get_stats(db, current_user.id, period_days)
