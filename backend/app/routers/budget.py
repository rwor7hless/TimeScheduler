import calendar
import csv
import io
import re
from datetime import date as _date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.budget import (
    BudgetAllocation,
    BudgetCategory,
    BudgetTag,
    PlannedPurchase,
    RecurringTransaction,
    Transaction,
    transaction_tags_table,
)
from app.models.user import User
from app.schemas.budget import (
    AllocationResponse,
    AllocationUpsert,
    BudgetCategoryCreate,
    BudgetCategoryResponse,
    BudgetCategoryUpdate,
    BudgetTagCreate,
    BudgetTagResponse,
    BudgetTagUpdate,
    HistoryResponse,
    PlannedConvertRequest,
    PlannedPurchaseCreate,
    PlannedPurchaseResponse,
    PlannedPurchaseUpdate,
    RecurringCreate,
    RecurringResponse,
    RecurringUpdate,
    SummaryResponse,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.services.budget_summary import build_summary

router = APIRouter(prefix="/api/budget", tags=["budget"], dependencies=[Depends(get_current_user)])


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _resolve_tags(db: AsyncSession, user_id: int, tag_ids: list[int]) -> list[BudgetTag]:
    if not tag_ids:
        return []
    result = await db.execute(
        select(BudgetTag).where(BudgetTag.id.in_(tag_ids), BudgetTag.user_id == user_id)
    )
    return list(result.scalars().all())


_DEFAULT_CATS = [
    ('food',          'Еда',           '🍔', '#F59E0B', 0),
    ('transport',     'Транспорт',     '🚗', '#3B82F6', 1),
    ('housing',       'Жильё',         '🏠', '#8B5CF6', 2),
    ('health',        'Здоровье',      '💊', '#10B981', 3),
    ('entertainment', 'Развлечения',   '🎮', '#F97316', 4),
    ('clothing',      'Одежда',        '👗', '#EC4899', 5),
    ('tech',          'Техника',       '💻', '#06B6D4', 6),
    ('education',     'Образование',   '📚', '#84CC16', 7),
    ('travel',        'Путешествия',   '✈️', '#EF4444', 8),
    ('subscriptions', 'Подписки',      '🔄', '#6366F1', 9),
    ('other',         'Прочее',        '📦', '#9CA3AF', 10),
]


async def _ensure_default_categories(db: AsyncSession, user_id: int) -> None:
    """Seed the 11 defaults on first access if user has none yet."""
    count = (
        await db.execute(
            select(func.count(BudgetCategory.id)).where(BudgetCategory.user_id == user_id)
        )
    ).scalar() or 0
    if count > 0:
        return
    for key, label, icon, color, order in _DEFAULT_CATS:
        db.add(
            BudgetCategory(
                user_id=user_id,
                key=key,
                label=label,
                icon=icon,
                color=color,
                sort_order=order,
            )
        )
    await db.commit()


def _slugify(label: str) -> str:
    cleaned = re.sub(r'[^\w]+', '-', label.strip().lower(), flags=re.UNICODE).strip('-')
    return (cleaned or 'cat')[:50]


# ── Budget Tags ────────────────────────────────────────────────────────────────

@router.get("/tags", response_model=list[BudgetTagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BudgetTag).where(BudgetTag.user_id == current_user.id).order_by(BudgetTag.name)
    )
    return result.scalars().all()


@router.post("/tags", response_model=BudgetTagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    data: BudgetTagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag = BudgetTag(user_id=current_user.id, name=data.name, color=data.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.put("/tags/{tag_id}", response_model=BudgetTagResponse)
async def update_tag(
    tag_id: int,
    data: BudgetTagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag = (
        await db.execute(
            select(BudgetTag).where(BudgetTag.id == tag_id, BudgetTag.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tag, field, value)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BudgetTag).where(BudgetTag.id == tag_id, BudgetTag.user_id == current_user.id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()


# ── Budget Categories ──────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[BudgetCategoryResponse])
async def list_categories(
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_default_categories(db, current_user.id)
    stmt = select(BudgetCategory).where(BudgetCategory.user_id == current_user.id)
    if not include_archived:
        stmt = stmt.where(BudgetCategory.is_archived.is_(False))
    stmt = stmt.order_by(BudgetCategory.sort_order, BudgetCategory.label)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/categories", response_model=BudgetCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: BudgetCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = data.key or _slugify(data.label)
    existing = (
        await db.execute(
            select(BudgetCategory).where(
                BudgetCategory.user_id == current_user.id,
                BudgetCategory.key == key,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this key already exists")

    if data.sort_order is None:
        max_order = (
            await db.execute(
                select(func.max(BudgetCategory.sort_order)).where(
                    BudgetCategory.user_id == current_user.id
                )
            )
        ).scalar() or 0
        sort_order = max_order + 1
    else:
        sort_order = data.sort_order

    cat = BudgetCategory(
        user_id=current_user.id,
        key=key,
        label=data.label,
        icon=data.icon,
        color=data.color,
        sort_order=sort_order,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.put("/categories/{cat_id}", response_model=BudgetCategoryResponse)
async def update_category(
    cat_id: int,
    data: BudgetCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = (
        await db.execute(
            select(BudgetCategory).where(
                BudgetCategory.id == cat_id,
                BudgetCategory.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = (
        await db.execute(
            select(BudgetCategory).where(
                BudgetCategory.id == cat_id,
                BudgetCategory.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()


# ── Allocations ────────────────────────────────────────────────────────────────

@router.get("/allocations", response_model=list[AllocationResponse])
async def list_allocations(
    year: int = Query(...),
    month: int = Query(...),  # 0-based
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BudgetAllocation)
        .where(
            BudgetAllocation.user_id == current_user.id,
            BudgetAllocation.year == year,
            BudgetAllocation.month == month,
        )
        .order_by(BudgetAllocation.category)
    )
    return result.scalars().all()


@router.post("/allocations", response_model=AllocationResponse)
async def upsert_allocation(
    data: AllocationUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BudgetAllocation).where(
            BudgetAllocation.user_id == current_user.id,
            BudgetAllocation.year == data.year,
            BudgetAllocation.month == data.month,
            BudgetAllocation.category == data.category,
        )
    )
    alloc = result.scalar_one_or_none()
    if alloc:
        alloc.limit_amount = data.limit_amount
    else:
        alloc = BudgetAllocation(
            user_id=current_user.id,
            year=data.year,
            month=data.month,
            category=data.category,
            limit_amount=data.limit_amount,
        )
        db.add(alloc)
    await db.commit()
    await db.refresh(alloc)
    return alloc


@router.delete("/allocations/{alloc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_allocation(
    alloc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BudgetAllocation).where(
            BudgetAllocation.id == alloc_id,
            BudgetAllocation.user_id == current_user.id,
        )
    )
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    await db.delete(alloc)
    await db.commit()


# ── Transactions ───────────────────────────────────────────────────────────────

@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    year: int | None = Query(None),
    month: int | None = Query(None),  # 0-based
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
    )
    if year is not None and month is not None:
        month_1based = month + 1
        last_day = calendar.monthrange(year, month_1based)[1]
        prefix_start = f"{year:04d}-{month_1based:02d}-01"
        prefix_end = f"{year:04d}-{month_1based:02d}-{last_day:02d}"
        query = query.where(Transaction.date >= prefix_start, Transaction.date <= prefix_end)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tags = await _resolve_tags(db, current_user.id, data.tag_ids)
    tx = Transaction(
        user_id=current_user.id,
        type=data.type,
        amount=data.amount,
        category=data.category,
        description=data.description,
        date=data.date,
        tags=tags,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.put("/transactions/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
    tx_id: int,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)

    for field, value in update_data.items():
        setattr(tx, field, value)

    if tag_ids is not None:
        tx.tags = await _resolve_tags(db, current_user.id, tag_ids)

    await db.commit()
    await db.refresh(tx)
    return tx


@router.delete("/transactions/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    tx_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(tx)
    await db.commit()


# ── Planned Purchases ──────────────────────────────────────────────────────────

@router.get("/planned", response_model=list[PlannedPurchaseResponse])
async def list_planned(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(PlannedPurchase)
        .where(PlannedPurchase.user_id == current_user.id)
        .order_by(PlannedPurchase.created_at)
    )
    if year is not None:
        query = query.where(PlannedPurchase.year == year)
    if month is not None:
        query = query.where(PlannedPurchase.month == month)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/planned", response_model=PlannedPurchaseResponse, status_code=status.HTTP_201_CREATED)
async def create_planned(
    data: PlannedPurchaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tags = await _resolve_tags(db, current_user.id, data.tag_ids)
    pp = PlannedPurchase(
        user_id=current_user.id,
        year=data.year,
        month=data.month,
        amount=data.amount,
        category=data.category,
        description=data.description,
        done=data.done,
        tags=tags,
    )
    db.add(pp)
    await db.commit()
    await db.refresh(pp)
    return pp


@router.put("/planned/{pp_id}", response_model=PlannedPurchaseResponse)
async def update_planned(
    pp_id: int,
    data: PlannedPurchaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PlannedPurchase).where(PlannedPurchase.id == pp_id, PlannedPurchase.user_id == current_user.id)
    )
    pp = result.scalar_one_or_none()
    if not pp:
        raise HTTPException(status_code=404, detail="Planned purchase not found")

    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)

    for field, value in update_data.items():
        setattr(pp, field, value)

    if tag_ids is not None:
        pp.tags = await _resolve_tags(db, current_user.id, tag_ids)

    await db.commit()
    await db.refresh(pp)
    return pp


@router.delete("/planned/{pp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_planned(
    pp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PlannedPurchase).where(PlannedPurchase.id == pp_id, PlannedPurchase.user_id == current_user.id)
    )
    pp = result.scalar_one_or_none()
    if not pp:
        raise HTTPException(status_code=404, detail="Planned purchase not found")
    await db.delete(pp)
    await db.commit()


@router.post("/planned/{pp_id}/convert", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def convert_planned(
    pp_id: int,
    data: PlannedConvertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pp = (
        await db.execute(
            select(PlannedPurchase).where(
                PlannedPurchase.id == pp_id,
                PlannedPurchase.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not pp:
        raise HTTPException(status_code=404, detail="Planned purchase not found")

    today_str = _date.today().isoformat()
    amount = data.amount if data.amount is not None else pp.amount
    tx_date = data.date or today_str

    if data.tag_ids is not None:
        tag_ids_to_use = data.tag_ids
    else:
        tag_ids_to_use = [t.id for t in pp.tags]
    tags = await _resolve_tags(db, current_user.id, tag_ids_to_use)

    tx = Transaction(
        user_id=current_user.id,
        type="expense",
        amount=amount,
        category=pp.category,
        description=pp.description,
        date=tx_date,
        source_planned_id=pp.id,
        tags=tags,
    )
    db.add(tx)
    await db.flush()
    await db.refresh(tx)
    # Plan fulfilled — remove it (tx now lives in expense list with source_planned_id for audit)
    await db.delete(pp)
    await db.commit()
    return tx


# ── Recurring Transactions ─────────────────────────────────────────────────────

@router.get("/recurring", response_model=list[RecurringResponse])
async def list_recurring(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(RecurringTransaction)
        .where(RecurringTransaction.user_id == current_user.id)
        .order_by(RecurringTransaction.day_of_month, RecurringTransaction.id)
    )
    return result.scalars().all()


@router.post("/recurring", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring(
    data: RecurringCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.day_of_month < 1 or data.day_of_month > 31:
        raise HTTPException(status_code=400, detail="day_of_month must be 1..31")
    tpl = RecurringTransaction(
        user_id=current_user.id,
        type=data.type,
        amount=data.amount,
        category=data.category,
        description=data.description,
        tag_ids=data.tag_ids or [],
        day_of_month=data.day_of_month,
        start_date=data.start_date,
        end_date=data.end_date,
        is_paused=data.is_paused,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.put("/recurring/{tpl_id}", response_model=RecurringResponse)
async def update_recurring(
    tpl_id: int,
    data: RecurringUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tpl = (
        await db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.id == tpl_id,
                RecurringTransaction.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Recurring template not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "day_of_month" and value is not None and (value < 1 or value > 31):
            raise HTTPException(status_code=400, detail="day_of_month must be 1..31")
        setattr(tpl, field, value)

    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/recurring/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(
    tpl_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tpl = (
        await db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.id == tpl_id,
                RecurringTransaction.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Recurring template not found")
    await db.delete(tpl)
    await db.commit()


# ── Summary (dashboard aggregate) ──────────────────────────────────────────────

@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    year: int = Query(...),
    month: int = Query(..., ge=0, le=11),  # 0-based
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await build_summary(db, current_user.id, year, month)


# ── History (filtered paginated list) ──────────────────────────────────────────

@router.get("/history", response_model=HistoryResponse)
async def get_history(
    q: str | None = Query(None, description="Search by description"),
    type: Literal["expense", "income"] | None = Query(None),
    tag_ids: list[int] = Query(default_factory=list),
    category: str | None = Query(None),
    from_: str | None = Query(None, alias="from", description="yyyy-MM-dd inclusive"),
    to: str | None = Query(None, description="yyyy-MM-dd inclusive"),
    amount_min: float | None = Query(None),
    amount_max: float | None = Query(None),
    sort: Literal["date", "amount"] = Query("date"),
    order: Literal["asc", "desc"] = Query("desc"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Transaction).where(Transaction.user_id == current_user.id)

    if type is not None:
        stmt = stmt.where(Transaction.type == type)
    if category is not None:
        stmt = stmt.where(Transaction.category == category)
    if from_ is not None:
        stmt = stmt.where(Transaction.date >= from_)
    if to is not None:
        stmt = stmt.where(Transaction.date <= to)
    if amount_min is not None:
        stmt = stmt.where(Transaction.amount >= amount_min)
    if amount_max is not None:
        stmt = stmt.where(Transaction.amount <= amount_max)
    if q:
        stmt = stmt.where(Transaction.description.ilike(f"%{q}%"))
    if tag_ids:
        stmt = (
            stmt.join(transaction_tags_table, transaction_tags_table.c.transaction_id == Transaction.id)
            .where(transaction_tags_table.c.tag_id.in_(tag_ids))
            .distinct()
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    order_col = Transaction.amount if sort == "amount" else Transaction.date
    order_expr = order_col.desc() if order == "desc" else order_col.asc()
    stmt = stmt.order_by(order_expr, Transaction.created_at.desc()).limit(limit).offset(offset)

    items = (await db.execute(stmt)).scalars().all()
    return HistoryResponse(items=items, total=total, offset=offset, limit=limit)


# ── CSV Export ────────────────────────────────────────────────────────────────

@router.get("/export")
async def export_transactions(
    year: int | None = Query(None),
    month: int | None = Query(None, ge=0, le=11),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    type: Literal["expense", "income"] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
    )

    if year is not None and month is not None:
        month_1 = month + 1
        last_day = calendar.monthrange(year, month_1)[1]
        stmt = stmt.where(
            Transaction.date >= f"{year:04d}-{month_1:02d}-01",
            Transaction.date <= f"{year:04d}-{month_1:02d}-{last_day:02d}",
        )
    if from_ is not None:
        stmt = stmt.where(Transaction.date >= from_)
    if to is not None:
        stmt = stmt.where(Transaction.date <= to)
    if type is not None:
        stmt = stmt.where(Transaction.type == type)

    rows = (await db.execute(stmt)).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["date", "type", "amount", "category", "description", "tags"])
    for t in rows:
        writer.writerow(
            [
                t.date,
                t.type,
                f"{t.amount:.2f}",
                t.category or "",
                t.description or "",
                ",".join(tag.name for tag in t.tags),
            ]
        )
    csv_content = buf.getvalue()

    if year is not None and month is not None:
        fname = f"budget-{year:04d}-{month + 1:02d}.csv"
    else:
        fname = "budget-all.csv"

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
