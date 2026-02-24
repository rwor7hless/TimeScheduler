from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.telegram import TelegramKey
from app.models.user import User

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


class ConnectRequest(BaseModel):
    key: str


class TelegramStatus(BaseModel):
    connected: bool


@router.get("/status", response_model=TelegramStatus)
async def telegram_status(
    current_user: User = Depends(get_current_user),
):
    return TelegramStatus(connected=bool(current_user.telegram_chat_id))


@router.post("/connect", response_model=TelegramStatus)
async def connect_telegram(
    body: ConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TelegramKey).where(TelegramKey.key == body.key)
    )
    tg_key = result.scalar_one_or_none()
    if not tg_key:
        raise HTTPException(status_code=404, detail="Ключ не найден. Проверьте правильность.")

    current_user.telegram_chat_id = tg_key.chat_id
    current_user.telegram_key = body.key

    # Remove used key from the pool
    await db.delete(tg_key)
    await db.commit()
    await db.refresh(current_user)

    return TelegramStatus(connected=True)


@router.delete("/connect", response_model=TelegramStatus)
async def disconnect_telegram(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.telegram_chat_id = None
    current_user.telegram_key = None
    await db.commit()
    return TelegramStatus(connected=False)
