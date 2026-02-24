from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HabitLog(Base):
    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_habit_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()"
    )

    habit: Mapped["Habit"] = relationship(back_populates="logs")


from app.models.habit import Habit  # noqa: E402, F401
