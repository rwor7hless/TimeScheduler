from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


transaction_tags_table = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", Integer, ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("budget_tags.id", ondelete="CASCADE"), primary_key=True),
)


class BudgetTag(Base):
    __tablename__ = "budget_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(7), default="#6B7280")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(10))  # 'expense' | 'income'
    amount: Mapped[float] = mapped_column(Float)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    date: Mapped[str] = mapped_column(String(10))  # yyyy-MM-dd
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")

    tags: Mapped[list["BudgetTag"]] = relationship(secondary=transaction_tags_table, lazy="selectin")


class PlannedPurchase(Base):
    __tablename__ = "planned_purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)  # 0-based
    amount: Mapped[float] = mapped_column(Float)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")


class BudgetAllocation(Base):
    __tablename__ = "budget_allocations"
    __table_args__ = (UniqueConstraint("user_id", "year", "month", "category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)  # 0-based
    category: Mapped[str] = mapped_column(String(50))
    limit_amount: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
