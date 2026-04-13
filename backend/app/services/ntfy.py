"""
Отправка push-уведомлений через ntfy.sh (или self-hosted ntfy).

Как подключить:
1. Установи приложение ntfy на телефон (iOS / Android)
2. Придумай уникальную тему, например: timescheduler-roman-abc123
3. Подпишись на эту тему в приложении
4. Добавь в .env:
       NTFY_TOPIC=timescheduler-roman-abc123
5. Готово — уведомления придут на телефон
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send(
    title: str,
    message: str,
    *,
    priority: str = "default",   # min | low | default | high | urgent
    tags: list[str] | None = None,
    click_url: str | None = None,
) -> bool:
    """
    Отправить push через ntfy.
    Возвращает True при успехе, False если ntfy не настроен или ошибка.
    """
    if not settings.ntfy_topic:
        return False

    url = f"{settings.ntfy_server.rstrip('/')}/{settings.ntfy_topic}"

    headers: dict[str, str] = {
        "Title": title,
        "Priority": priority,
        "Content-Type": "text/plain; charset=utf-8",
    }
    if tags:
        headers["Tags"] = ",".join(tags)
    if click_url:
        headers["Click"] = click_url

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, content=message.encode(), headers=headers)
            resp.raise_for_status()
            logger.info(f"ntfy: sent '{title}' → {url}")
            return True
    except Exception as e:
        logger.warning(f"ntfy: failed to send '{title}': {e}")
        return False
