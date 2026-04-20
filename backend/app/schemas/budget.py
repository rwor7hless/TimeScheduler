from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# ── Budget Tags ────────────────────────────────────────────────────────────────

class BudgetTagCreate(BaseModel):
    name: str
    color: str = "#6B7280"


class BudgetTagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class BudgetTagResponse(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


# ── Budget Categories ──────────────────────────────────────────────────────────

class BudgetCategoryCreate(BaseModel):
    key: str | None = None  # если пусто — сгенерим из label
    label: str
    icon: str = "📦"
    color: str = "#9CA3AF"
    sort_order: int | None = None


class BudgetCategoryUpdate(BaseModel):
    label: str | None = None
    icon: str | None = None
    color: str | None = None
    sort_order: int | None = None
    is_archived: bool | None = None


class BudgetCategoryResponse(BaseModel):
    id: int
    key: str
    label: str
    icon: str
    color: str
    sort_order: int
    is_archived: bool

    model_config = {"from_attributes": True}


# ── Transactions ───────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    type: Literal["expense", "income"]
    amount: float
    category: str | None = None
    description: str = ""
    date: str  # yyyy-MM-dd
    tag_ids: list[int] = []


class TransactionUpdate(BaseModel):
    type: Literal["expense", "income"] | None = None
    amount: float | None = None
    category: str | None = None
    description: str | None = None
    date: str | None = None
    tag_ids: list[int] | None = None


class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: float
    category: str | None
    description: str
    date: str
    created_at: datetime
    tags: list[BudgetTagResponse] = []
    source_planned_id: int | None = None

    model_config = {"from_attributes": True}


# ── Planned Purchases ──────────────────────────────────────────────────────────

class PlannedPurchaseCreate(BaseModel):
    year: int
    month: int  # 0-based
    amount: float
    category: str | None = None
    description: str = ""
    done: bool = False
    tag_ids: list[int] = []


class PlannedPurchaseUpdate(BaseModel):
    amount: float | None = None
    category: str | None = None
    description: str | None = None
    done: bool | None = None
    tag_ids: list[int] | None = None


class PlannedPurchaseResponse(BaseModel):
    id: int
    year: int
    month: int
    amount: float
    category: str | None
    description: str
    done: bool
    created_at: datetime
    tags: list[BudgetTagResponse] = []
    source_recurring_id: int | None = None

    model_config = {"from_attributes": True}


class PlannedConvertRequest(BaseModel):
    amount: float | None = None
    date: str | None = None  # yyyy-MM-dd, default = today
    tag_ids: list[int] | None = None


# ── Budget Allocations ─────────────────────────────────────────────────────────

class AllocationUpsert(BaseModel):
    year: int
    month: int  # 0-based
    category: str
    limit_amount: float


class AllocationResponse(BaseModel):
    id: int
    year: int
    month: int
    category: str
    limit_amount: float
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Recurring Transactions ─────────────────────────────────────────────────────

class RecurringCreate(BaseModel):
    type: Literal["expense", "income"]
    amount: float
    category: str | None = None
    description: str = ""
    tag_ids: list[int] = []
    day_of_month: int
    start_date: str  # yyyy-MM-dd
    end_date: str | None = None
    is_paused: bool = False


class RecurringUpdate(BaseModel):
    type: Literal["expense", "income"] | None = None
    amount: float | None = None
    category: str | None = None
    description: str | None = None
    tag_ids: list[int] | None = None
    day_of_month: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_paused: bool | None = None


class RecurringResponse(BaseModel):
    id: int
    type: str
    amount: float
    category: str | None
    description: str
    tag_ids: list[int]
    day_of_month: int
    start_date: str
    end_date: str | None
    last_generated_date: str | None
    is_paused: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Summary (dashboard aggregate) ──────────────────────────────────────────────

class SummaryTotals(BaseModel):
    income: float
    expense: float
    balance: float
    planned_pending: float
    planned_done: float


class SummaryCategory(BaseModel):
    category: str | None
    allocated: float  # 0 if no allocation
    spent: float
    planned_pending: float
    remaining: float  # allocated - spent - planned_pending
    pct: float  # spent / allocated * 100, 0 if no allocation


class SummaryDay(BaseModel):
    date: str  # yyyy-MM-dd
    expense: float
    income: float


class SummaryTrend(BaseModel):
    prev_expense: float
    delta_abs: float
    delta_pct: float | None  # None when prev is 0


class SummaryProjection(BaseModel):
    days_passed: int
    days_total: int
    days_left: int
    rate_per_day: float
    projected_total: float
    daily_budget: float  # sum of allocations / days_total


class SummaryResponse(BaseModel):
    year: int
    month: int
    totals: SummaryTotals
    by_category: list[SummaryCategory]
    daily: list[SummaryDay]
    trend: SummaryTrend
    projection: SummaryProjection


# ── History (filtered paginated list) ──────────────────────────────────────────

class HistoryResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    offset: int
    limit: int
