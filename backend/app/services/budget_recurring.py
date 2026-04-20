"""
Генератор регулярных транзакций.

Запускается по крону раз в сутки. Для каждого активного шаблона проверяет,
не пропущен ли месяц — если пропущен, создаёт транзакцию за каждый такой
месяц на дне `day_of_month` (зажатом до последнего дня месяца).
"""
import calendar
import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.budget import BudgetTag, RecurringTransaction, Transaction

logger = logging.getLogger(__name__)


def _clamp_day(year: int, month_1: int, day: int) -> date:
    """Day-of-month → actual date, clamped to last day of month."""
    last_day = calendar.monthrange(year, month_1)[1]
    return date(year, month_1, min(day, last_day))


async def _resolve_tags(db: AsyncSession, user_id: int, tag_ids: list[int]) -> list[BudgetTag]:
    if not tag_ids:
        return []
    result = await db.execute(
        select(BudgetTag).where(BudgetTag.id.in_(tag_ids), BudgetTag.user_id == user_id)
    )
    return list(result.scalars().all())


async def _generate_for_template(
    db: AsyncSession, tpl: RecurringTransaction, today: date
) -> int:
    """Создаёт недостающие транзакции для одного шаблона. Возвращает сколько создано."""
    created = 0

    # Начальная точка: следующий месяц после last_generated_date
    # или start_date, если генераций ещё не было.
    if tpl.last_generated_date:
        last = date.fromisoformat(tpl.last_generated_date)
        cursor_y, cursor_m = (
            (last.year, last.month + 1) if last.month < 12 else (last.year + 1, 1)
        )
    else:
        start = date.fromisoformat(tpl.start_date)
        cursor_y, cursor_m = start.year, start.month

    end_date = date.fromisoformat(tpl.end_date) if tpl.end_date else None

    # Генерим по одной транзакции за каждый месяц, день которого уже наступил
    while True:
        target = _clamp_day(cursor_y, cursor_m, tpl.day_of_month)
        if target > today:
            break
        if end_date and target > end_date:
            break

        # Проверка: уже есть транзакция с таким исходным шаблоном и датой?
        existing = (
            await db.execute(
                select(Transaction).where(
                    Transaction.user_id == tpl.user_id,
                    Transaction.date == target.isoformat(),
                    Transaction.source_planned_id.is_(None),
                    Transaction.amount == tpl.amount,
                    Transaction.description == tpl.description,
                    Transaction.category == tpl.category,
                )
            )
        ).scalar_one_or_none()

        if not existing:
            tags = await _resolve_tags(db, tpl.user_id, tpl.tag_ids or [])
            tx = Transaction(
                user_id=tpl.user_id,
                type=tpl.type,
                amount=tpl.amount,
                category=tpl.category,
                description=tpl.description,
                date=target.isoformat(),
                tags=tags,
            )
            db.add(tx)
            created += 1

        tpl.last_generated_date = target.isoformat()

        # Следующий месяц
        if cursor_m == 12:
            cursor_y, cursor_m = cursor_y + 1, 1
        else:
            cursor_m += 1

        # Защита от бесконечного цикла при странных данных
        if cursor_y > today.year + 1:
            break

    return created


async def generate_recurring_transactions() -> None:
    """Фоновая джоба — запускается из APScheduler раз в сутки."""
    today = date.today()
    async with async_session() as db:
        templates = (
            await db.execute(
                select(RecurringTransaction).where(RecurringTransaction.is_paused.is_(False))
            )
        ).scalars().all()

        total_created = 0
        for tpl in templates:
            try:
                total_created += await _generate_for_template(db, tpl, today)
            except Exception:
                logger.exception("recurring: failed to process template id=%s", tpl.id)

        await db.commit()

    if total_created:
        logger.info("recurring: generated %d transactions", total_created)
