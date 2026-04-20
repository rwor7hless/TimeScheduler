"""
Агрегирующая логика бюджета для /summary и AI-отчёта.

Собирает: totals, by_category, daily breakdown, trend (vs prev month), projection.
"""
import calendar
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import BudgetAllocation, PlannedPurchase, Transaction
from app.schemas.budget import (
    SummaryCategory,
    SummaryDay,
    SummaryProjection,
    SummaryResponse,
    SummaryTotals,
    SummaryTrend,
)


def _month_range(year: int, month_0: int) -> tuple[str, str, int]:
    """Returns (prefix_start, prefix_end, days_in_month) for the given 0-based month."""
    month_1 = month_0 + 1
    last_day = calendar.monthrange(year, month_1)[1]
    return (
        f"{year:04d}-{month_1:02d}-01",
        f"{year:04d}-{month_1:02d}-{last_day:02d}",
        last_day,
    )


def _prev_month(year: int, month_0: int) -> tuple[int, int]:
    """Returns (prev_year, prev_month_0)."""
    if month_0 == 0:
        return (year - 1, 11)
    return (year, month_0 - 1)


async def _sum_expense(db: AsyncSession, user_id: int, start: str, end: str) -> float:
    rows = await db.execute(
        select(Transaction.amount).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    return sum(r[0] for r in rows.all())


async def build_summary(db: AsyncSession, user_id: int, year: int, month_0: int) -> SummaryResponse:
    prefix_start, prefix_end, days_total = _month_range(year, month_0)

    # Все транзакции текущего месяца
    tx_rows = (
        await db.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.date >= prefix_start,
                Transaction.date <= prefix_end,
            )
        )
    ).scalars().all()

    # Все планы текущего месяца
    planned_rows = (
        await db.execute(
            select(PlannedPurchase).where(
                PlannedPurchase.user_id == user_id,
                PlannedPurchase.year == year,
                PlannedPurchase.month == month_0,
            )
        )
    ).scalars().all()

    # Лимиты текущего месяца
    alloc_rows = (
        await db.execute(
            select(BudgetAllocation).where(
                BudgetAllocation.user_id == user_id,
                BudgetAllocation.year == year,
                BudgetAllocation.month == month_0,
            )
        )
    ).scalars().all()

    # ── Totals ─────────────────────────────────────────────────────────────────
    total_income = sum(t.amount for t in tx_rows if t.type == "income")
    total_expense = sum(t.amount for t in tx_rows if t.type == "expense")
    planned_pending = sum(p.amount for p in planned_rows if not p.done)
    planned_done = sum(p.amount for p in planned_rows if p.done)

    totals = SummaryTotals(
        income=total_income,
        expense=total_expense,
        balance=total_income - total_expense,
        planned_pending=planned_pending,
        planned_done=planned_done,
    )

    # ── By category ────────────────────────────────────────────────────────────
    spent_by_cat: dict[str | None, float] = defaultdict(float)
    for t in tx_rows:
        if t.type == "expense":
            spent_by_cat[t.category] += t.amount

    planned_by_cat: dict[str | None, float] = defaultdict(float)
    for p in planned_rows:
        if not p.done:
            planned_by_cat[p.category] += p.amount

    alloc_by_cat: dict[str, float] = {a.category: a.limit_amount for a in alloc_rows}

    all_cats: set[str | None] = set(spent_by_cat.keys()) | set(planned_by_cat.keys()) | set(alloc_by_cat.keys())
    by_category: list[SummaryCategory] = []
    for cat in all_cats:
        allocated = alloc_by_cat.get(cat, 0.0) if cat else 0.0
        spent = spent_by_cat.get(cat, 0.0)
        pending = planned_by_cat.get(cat, 0.0)
        remaining = allocated - spent - pending if allocated else 0.0
        pct = (spent / allocated * 100) if allocated > 0 else 0.0
        by_category.append(
            SummaryCategory(
                category=cat,
                allocated=allocated,
                spent=spent,
                planned_pending=pending,
                remaining=remaining,
                pct=pct,
            )
        )
    by_category.sort(key=lambda c: (c.category is None, -c.spent))

    # ── Daily breakdown ────────────────────────────────────────────────────────
    daily_map: dict[str, tuple[float, float]] = {}  # date → (expense, income)
    for d in range(1, days_total + 1):
        key = f"{year:04d}-{month_0 + 1:02d}-{d:02d}"
        daily_map[key] = (0.0, 0.0)

    for t in tx_rows:
        exp, inc = daily_map.get(t.date, (0.0, 0.0))
        if t.type == "expense":
            exp += t.amount
        else:
            inc += t.amount
        daily_map[t.date] = (exp, inc)

    daily = [SummaryDay(date=k, expense=v[0], income=v[1]) for k, v in sorted(daily_map.items())]

    # ── Trend vs previous month ────────────────────────────────────────────────
    prev_y, prev_m = _prev_month(year, month_0)
    prev_start, prev_end, _ = _month_range(prev_y, prev_m)
    prev_expense = await _sum_expense(db, user_id, prev_start, prev_end)
    delta_abs = total_expense - prev_expense
    delta_pct = (delta_abs / prev_expense * 100) if prev_expense > 0 else None

    trend = SummaryTrend(
        prev_expense=prev_expense,
        delta_abs=delta_abs,
        delta_pct=delta_pct,
    )

    # ── Projection ─────────────────────────────────────────────────────────────
    today = date.today()
    current_y = today.year
    current_m_0 = today.month - 1

    if (year, month_0) == (current_y, current_m_0):
        days_passed = today.day
    elif (year, month_0) < (current_y, current_m_0):
        # прошлый или более ранний месяц — полностью закрыт
        days_passed = days_total
    else:
        # будущий месяц — ещё не начался
        days_passed = 0

    days_left = max(0, days_total - days_passed)
    rate_per_day = (total_expense / days_passed) if days_passed > 0 else 0.0
    projected_total = rate_per_day * days_total if days_passed > 0 else total_expense
    total_allocated = sum(alloc_by_cat.values())
    daily_budget = (total_allocated / days_total) if days_total > 0 else 0.0

    projection = SummaryProjection(
        days_passed=days_passed,
        days_total=days_total,
        days_left=days_left,
        rate_per_day=rate_per_day,
        projected_total=projected_total,
        daily_budget=daily_budget,
    )

    return SummaryResponse(
        year=year,
        month=month_0,
        totals=totals,
        by_category=by_category,
        daily=daily,
        trend=trend,
        projection=projection,
    )


async def build_weekly_budget_block(
    db: AsyncSession, user_id: int, week_end: date
) -> dict:
    """
    Данные для недельного AI-отчёта: траты за 7 дней + сравнение со средним за 4 недели.
    Возвращает dict, чтобы встроить в weekly_report_prompt без цепной зависимости.
    """
    week_start = week_end - timedelta(days=6)
    w_start_str = week_start.strftime("%Y-%m-%d")
    w_end_str = week_end.strftime("%Y-%m-%d")

    rows = (
        await db.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.date >= w_start_str,
                Transaction.date <= w_end_str,
            )
        )
    ).scalars().all()

    total_expense = sum(t.amount for t in rows if t.type == "expense")
    total_income = sum(t.amount for t in rows if t.type == "income")

    by_cat: dict[str | None, float] = defaultdict(float)
    for t in rows:
        if t.type == "expense":
            by_cat[t.category] += t.amount
    top_categories = sorted(by_cat.items(), key=lambda kv: -kv[1])[:3]

    # Среднее за 4 предыдущие недели
    baseline_start = (week_start - timedelta(days=28)).strftime("%Y-%m-%d")
    baseline_end = (week_start - timedelta(days=1)).strftime("%Y-%m-%d")
    baseline = await _sum_expense(db, user_id, baseline_start, baseline_end)
    avg_per_week = baseline / 4.0 if baseline > 0 else 0.0
    delta_pct = None
    if avg_per_week > 0:
        delta_pct = (total_expense - avg_per_week) / avg_per_week * 100

    # Планы за эту неделю: сколько выполнено, сколько всего на текущий месяц
    month_0 = week_end.month - 1
    year = week_end.year
    planned_rows = (
        await db.execute(
            select(PlannedPurchase).where(
                PlannedPurchase.user_id == user_id,
                PlannedPurchase.year == year,
                PlannedPurchase.month == month_0,
            )
        )
    ).scalars().all()
    planned_total = len(planned_rows)
    planned_done = sum(1 for p in planned_rows if p.done)

    # Перебор лимитов
    alloc_rows = (
        await db.execute(
            select(BudgetAllocation).where(
                BudgetAllocation.user_id == user_id,
                BudgetAllocation.year == year,
                BudgetAllocation.month == month_0,
            )
        )
    ).scalars().all()
    alloc_by_cat = {a.category: a.limit_amount for a in alloc_rows}

    # Расходы с начала месяца до конца недели
    mstart = f"{year:04d}-{month_0 + 1:02d}-01"
    month_tx_rows = (
        await db.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.type == "expense",
                Transaction.date >= mstart,
                Transaction.date <= w_end_str,
            )
        )
    ).scalars().all()
    spent_by_cat: dict[str | None, float] = defaultdict(float)
    for t in month_tx_rows:
        spent_by_cat[t.category] += t.amount
    overspent = [
        (cat, spent_by_cat[cat], lim)
        for cat, lim in alloc_by_cat.items()
        if spent_by_cat.get(cat, 0) > lim
    ]

    return {
        "total_expense": total_expense,
        "total_income": total_income,
        "top_categories": [(c, s) for c, s in top_categories],
        "avg_per_week": avg_per_week,
        "delta_pct": delta_pct,
        "planned_done": planned_done,
        "planned_total": planned_total,
        "overspent": overspent,  # list of (category, spent, limit)
    }
