from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.budget import BudgetAllocation, BudgetTag, PlannedPurchase, Transaction
from app.models.user import User
from app.schemas.budget import (
    AllocationResponse,
    AllocationUpsert,
    BudgetTagCreate,
    BudgetTagResponse,
    PlannedPurchaseCreate,
    PlannedPurchaseResponse,
    PlannedPurchaseUpdate,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)

router = APIRouter(prefix="/api/budget", tags=["budget"], dependencies=[Depends(get_current_user)])


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
        import calendar
        month_1based = month + 1
        last_day = calendar.monthrange(year, month_1based)[1]
        prefix_start = f"{year:04d}-{month_1based:02d}-01"
        prefix_end = f"{year:04d}-{month_1based:02d}-{last_day:02d}"
        query = query.where(Transaction.date >= prefix_start, Transaction.date <= prefix_end)

    result = await db.execute(query)
    return result.scalars().all()


async def _resolve_tags(db: AsyncSession, user_id: int, tag_ids: list[int]) -> list[BudgetTag]:
    if not tag_ids:
        return []
    result = await db.execute(
        select(BudgetTag).where(BudgetTag.id.in_(tag_ids), BudgetTag.user_id == user_id)
    )
    return list(result.scalars().all())


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
    pp = PlannedPurchase(
        user_id=current_user.id,
        year=data.year,
        month=data.month,
        amount=data.amount,
        category=data.category,
        description=data.description,
        done=data.done,
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

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pp, field, value)

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
