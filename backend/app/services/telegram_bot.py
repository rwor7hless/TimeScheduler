import logging
import secrets
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

POLL_TIMEOUT_SECONDS = 25  # long-poll окно у Telegram (max 50, держим запас)


def _base_url() -> str:
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}"


def generate_key() -> str:
    return secrets.token_urlsafe(32)


async def send_message(chat_id: str, text: str, parse_mode: str | None = None) -> bool:
    if not settings.telegram_bot_token:
        return False
    payload: dict = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post(f"{_base_url()}/sendMessage", json=payload)
        except httpx.HTTPError as exc:
            logger.warning("Telegram sendMessage failed: %s", exc)
            return False
        return r.status_code == 200


async def _get_offset(session) -> int:
    from sqlalchemy import select
    from app.models.telegram import TelegramState

    result = await session.execute(select(TelegramState).where(TelegramState.id == 1))
    state = result.scalar_one_or_none()
    if state is None:
        state = TelegramState(id=1, last_update_id=0)
        session.add(state)
        await session.commit()
        await session.refresh(state)
    return state.last_update_id


async def _set_offset(session, value: int) -> None:
    from sqlalchemy import select
    from app.models.telegram import TelegramState

    result = await session.execute(select(TelegramState).where(TelegramState.id == 1))
    state = result.scalar_one_or_none()
    if state is None:
        state = TelegramState(id=1, last_update_id=value)
        session.add(state)
    else:
        state.last_update_id = value
    await session.commit()


async def _handle_start(session, chat_id: str) -> str:
    """Возвращает уже отформатированное сообщение для отправки в чат."""
    from sqlalchemy import select
    from app.models.telegram import TelegramKey

    existing = await session.execute(
        select(TelegramKey).where(TelegramKey.chat_id == chat_id)
    )
    tg_key = existing.scalar_one_or_none()

    if tg_key is None:
        key = generate_key()
        while True:
            collision = await session.execute(
                select(TelegramKey).where(TelegramKey.key == key)
            )
            if collision.scalar_one_or_none() is None:
                break
            key = generate_key()

        tg_key = TelegramKey(key=key, chat_id=chat_id)
        session.add(tg_key)
        await session.commit()
        intro = "Ваш ключ для TimeScheduler:\n\n"
    else:
        key = tg_key.key
        intro = "У вас уже есть ключ:\n\n"

    return (
        intro
        + f"`{key}`\n\n"
        + "Вставьте его в настройках приложения \\(кнопка Telegram в шапке\\)\\."
    )


async def poll_telegram_updates() -> None:
    """Long-poll Telegram getUpdates и обработка /start.

    Offset хранится в БД (telegram_state.last_update_id), что предотвращает
    дубль-обработку при перезапуске и при наслаивании запросов.
    """
    if not settings.telegram_bot_token:
        return

    from app.database import async_session

    async with async_session() as session:
        offset = await _get_offset(session)

    async with httpx.AsyncClient(timeout=POLL_TIMEOUT_SECONDS + 5) as client:
        try:
            r = await client.get(
                f"{_base_url()}/getUpdates",
                params={"offset": offset + 1, "timeout": POLL_TIMEOUT_SECONDS},
            )
        except httpx.HTTPError as exc:
            logger.debug("Telegram getUpdates failed: %s", exc)
            return

        if r.status_code != 200:
            logger.warning("Telegram getUpdates HTTP %s: %s", r.status_code, r.text[:200])
            return

        updates = r.json().get("result", [])

    if not updates:
        return

    new_offset = offset
    async with async_session() as session:
        for update in updates:
            try:
                update_id = int(update["update_id"])
                new_offset = max(new_offset, update_id)

                message = update.get("message")
                if not message:
                    continue

                text = (message.get("text") or "").strip()
                chat = message.get("chat") or {}
                chat_id = str(chat.get("id"))
                if not chat_id or chat_id == "None":
                    continue

                if text.startswith("/start"):
                    reply = await _handle_start(session, chat_id)
                    await send_message(chat_id, reply, parse_mode="MarkdownV2")
            except Exception as exc:
                logger.exception("Failed to handle telegram update: %s", exc)
                # один битый апдейт не должен валить весь батч

        if new_offset > offset:
            await _set_offset(session, new_offset)


async def send_telegram_reminders() -> None:
    """Check tasks with pending TG reminders and send notifications."""
    from app.database import async_session
    from app.models.task import Task
    from app.models.user import User
    from sqlalchemy import select

    now = datetime.now(timezone.utc)

    async with async_session() as session:
        result = await session.execute(
            select(Task, User)
            .join(User, Task.user_id == User.id)
            .where(
                Task.tg_remind.is_(True),
                Task.tg_reminded.is_(False),
                Task.tg_remind_at <= now,
                User.telegram_chat_id.is_not(None),
            )
        )
        rows = result.all()

        for task, user in rows:
            scheduled = task.scheduled_start
            if scheduled:
                if scheduled.tzinfo is None:
                    scheduled = scheduled.replace(tzinfo=timezone.utc)
                local_time = scheduled.astimezone(ZoneInfo(settings.user_timezone))
                time_str = local_time.strftime("%d.%m.%Y %H:%M")
            else:
                time_str = "не указано"

            text = (
                f'Напоминание о "{task.title}", '
                f"запланировано на {time_str}. Не пропустите."
            )

            sent = await send_message(user.telegram_chat_id, text)
            if sent:
                task.tg_reminded = True

        await session.commit()
