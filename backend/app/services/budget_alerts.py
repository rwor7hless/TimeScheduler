"""
Проверка превышения лимитов бюджета и рассылка уведомлений.

Пороги: 80% / 100% / 120% от лимита категории за текущий месяц.
Защита от дублей — через budget_alert_log (unique per user+year+month+category+threshold).
Запускается по крону пару раз в день из main.py.
"""
import calendar
import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models.budget import BudgetAlertLog, BudgetAllocation, Transaction
from app.models.user import User
from app.services.ntfy import send as ntfy_send
from app.services.telegram_bot import send_message as telegram_send

logger = logging.getLogger(__name__)

THRESHOLDS = [80, 100, 120]


async def _month_spent(
    db: AsyncSession, user_id: int, year: int, month_0: int, category: str
) -> float:
    month_1 = month_0 + 1
    last_day = calendar.monthrange(year, month_1)[1]
    start = f"{year:04d}-{month_1:02d}-01"
    end = f"{year:04d}-{month_1:02d}-{last_day:02d}"
    rows = await db.execute(
        select(Transaction.amount).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.category == category,
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    return sum(r[0] for r in rows.all())


async def _send_alert(
    user: User, category: str, spent: float, limit: float, threshold: int
) -> None:
    pct = int(spent / limit * 100) if limit > 0 else threshold
    if threshold == 80:
        message = f"Уже {pct}% лимита «{category}» — осталось {int(limit - spent)} ₽."
        priority = "default"
    elif threshold == 100:
        message = f"Лимит «{category}» потрачен полностью ({int(spent)} из {int(limit)} ₽)."
        priority = "high"
    else:
        message = f"Перерасход «{category}»: {int(spent)} из {int(limit)} ₽ (+{pct - 100}% сверх)."
        priority = "high"

    title = f"Бюджет: {category} {pct}%"

    if user.telegram_chat_id:
        try:
            await telegram_send(user.telegram_chat_id, f"{title}\n{message}")
        except Exception:
            logger.exception("budget alert: telegram send failed for user_id=%s", user.id)

    if settings.ntfy_topic:
        try:
            await ntfy_send(title=title, message=message, priority=priority, tags=["warning"])
        except Exception:
            logger.exception("budget alert: ntfy send failed")


async def check_budget_alerts() -> None:
    """Scheduled job — runs twice a day. Sends alerts for new threshold crossings."""
    today = date.today()
    year = today.year
    month_0 = today.month - 1

    async with async_session() as db:
        users = (await db.execute(select(User))).scalars().all()
        for user in users:
            allocs = (
                await db.execute(
                    select(BudgetAllocation).where(
                        BudgetAllocation.user_id == user.id,
                        BudgetAllocation.year == year,
                        BudgetAllocation.month == month_0,
                    )
                )
            ).scalars().all()

            for alloc in allocs:
                if alloc.limit_amount <= 0:
                    continue

                spent = await _month_spent(db, user.id, year, month_0, alloc.category)
                pct = spent / alloc.limit_amount * 100

                for threshold in THRESHOLDS:
                    if pct < threshold:
                        continue
                    existing = await db.execute(
                        select(BudgetAlertLog).where(
                            BudgetAlertLog.user_id == user.id,
                            BudgetAlertLog.year == year,
                            BudgetAlertLog.month == month_0,
                            BudgetAlertLog.category == alloc.category,
                            BudgetAlertLog.threshold == threshold,
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue

                    try:
                        await _send_alert(user, alloc.category, spent, alloc.limit_amount, threshold)
                    except Exception:
                        logger.exception("budget alert: send_alert failed")
                        continue

                    db.add(
                        BudgetAlertLog(
                            user_id=user.id,
                            year=year,
                            month=month_0,
                            category=alloc.category,
                            threshold=threshold,
                        )
                    )

        await db.commit()
