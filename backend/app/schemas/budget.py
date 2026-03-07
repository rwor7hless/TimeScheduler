from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# ── Budget Tags ────────────────────────────────────────────────────────────────

class BudgetTagCreate(BaseModel):
    name: str
    color: str = "#6B7280"


class BudgetTagResponse(BaseModel):
    id: int
    name: str
    color: str

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

    model_config = {"from_attributes": True}


# ── Planned Purchases ──────────────────────────────────────────────────────────

class PlannedPurchaseCreate(BaseModel):
    year: int
    month: int  # 0-based
    amount: float
    category: str | None = None
    description: str = ""
    done: bool = False


class PlannedPurchaseUpdate(BaseModel):
    amount: float | None = None
    category: str | None = None
    description: str | None = None
    done: bool | None = None


class PlannedPurchaseResponse(BaseModel):
    id: int
    year: int
    month: int
    amount: float
    category: str | None
    description: str
    done: bool
    created_at: datetime

    model_config = {"from_attributes": True}


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
