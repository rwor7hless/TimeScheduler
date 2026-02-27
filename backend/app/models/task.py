import enum
from datetime import datetime, timezone

from sqlalchemy import ARRAY, Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.board import Board


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Priority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class KanbanStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tag_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(7), default="#6B7280")

    tasks: Mapped[list["Task"]] = relationship(secondary=task_tags, back_populates="tags")


TASK_COLOR_PALETTE = [
    "#3B82F6",  # blue
    "#10B981",  # emerald
    "#F59E0B",  # amber
    "#EF4444",  # red
    "#8B5CF6",  # violet
    "#EC4899",  # pink
    "#06B6D4",  # cyan
    "#84CC16",  # lime
    "#F97316",  # orange
    "#6366F1",  # indigo
]


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    board_id: Mapped[int | None] = mapped_column(
        ForeignKey("boards.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    color: Mapped[str] = mapped_column(String(7), default="#6B7280")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.MEDIUM)
    status: Mapped[KanbanStatus] = mapped_column(Enum(KanbanStatus), default=KanbanStatus.TODO)
    kanban_order: Mapped[int] = mapped_column(Integer, default=0)

    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    repeat_days: Mapped[list[int] | None] = mapped_column(ARRAY(Integer()), nullable=True)  # 0=Mon..6=Sun
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    tg_remind: Mapped[bool] = mapped_column(Boolean, default=False)
    tg_remind_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tg_reminded: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", onupdate=_utcnow
    )

    tags: Mapped[list["Tag"]] = relationship(
        secondary=task_tags, back_populates="tasks", lazy="selectin"
    )

    board: Mapped[Board | None] = relationship("Board", back_populates="tasks")
