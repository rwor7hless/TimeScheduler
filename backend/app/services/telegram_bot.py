import secrets
from datetime import datetime, timezone, timedelta

import httpx

from app.config import settings

_last_update_id: int = 0


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
        r = await client.post(
            f"{_base_url()}/sendMessage",
            json=payload,
        )
        return r.status_code == 200


async def poll_telegram_updates() -> None:
    """Poll Telegram getUpdates and handle /start commands."""
    global _last_update_id
    if not settings.telegram_bot_token:
        return

    from app.database import async_session
    from app.models.telegram import TelegramKey
    from sqlalchemy import select

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(
                f"{_base_url()}/getUpdates",
                params={"offset": _last_update_id + 1, "timeout": 0},
            )
        except Exception:
            return

        if r.status_code != 200:
            return

        data = r.json()
        updates = data.get("result", [])

    for update in updates:
        _last_update_id = update["update_id"]
        message = update.get("message")
        if not message:
            continue

        text = message.get("text", "")
        chat_id = str(message["chat"]["id"])

        if text.strip().startswith("/start"):
            async with async_session() as session:
                # Check if this chat already has a pending key
                existing = await session.execute(
                    select(TelegramKey).where(TelegramKey.chat_id == chat_id)
                )
                tg_key = existing.scalar_one_or_none()

                if tg_key is None:
                    # Generate a new unique key
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

            reply = (
                intro
                + f"`{key}`\n\n"
                + "Вставьте его в настройках приложения \\(кнопка Telegram в шапке\\)\\."
            )
            await send_message(chat_id, reply, parse_mode="MarkdownV2")


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
                # scheduled_start is stored as UTC, but was sent by the browser
                # already offset (new Date("YYYY-MM-DDTHH:MM:00").toISOString()),
                # so UTC value equals the local time the user picked minus their offset.
                # Re-add UTC+3 (Moscow) to recover what the user intended.
                if scheduled.tzinfo is None:
                    scheduled = scheduled.replace(tzinfo=timezone.utc)
                local_time = scheduled.astimezone(timezone(timedelta(hours=3)))
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
