from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class TransactionCreate(BaseModel):
    type: Literal["expense", "income"]
    amount: float
    category: str | None = None
    description: str = ""
    date: str  # yyyy-MM-dd


class TransactionUpdate(BaseModel):
    type: Literal["expense", "income"] | None = None
    amount: float | None = None
    category: str | None = None
    description: str | None = None
    date: str | None = None


class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: float
    category: str | None
    description: str
    date: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
