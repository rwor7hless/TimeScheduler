from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TelegramKey(Base):
    __tablename__ = "telegram_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    chat_id: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()"
    )


class TelegramState(Base):
    """Глобальное состояние Telegram-поллера (одна строка с id=1)."""

    __tablename__ = "telegram_state"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    last_update_id: Mapped[int] = mapped_column(BigInteger, default=0)
