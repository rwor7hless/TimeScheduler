"""
GigaChat client через OpenAI-совместимый API (cloud.ru).
"""
import logging

import httpx
from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AsyncOpenAI,
    RateLimitError,
)

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://foundation-models.api.cloud.ru/v1"
MODEL = "ai-sage/GigaChat3-10B-A1.8B"

# Нестримовый клиент: жёсткий таймаут на весь запрос (короткие ответы типа daily-tip).
SHORT_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=30.0, pool=10.0)
# Стримовый клиент: read=None, иначе httpx порубит середину генерации.
# connect/write остаются жёсткими — если сеть мертва, это видно сразу.
STREAM_TIMEOUT = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0)


def _client(*, stream: bool = False) -> AsyncOpenAI:
    if not settings.gigachat_api_key:
        raise RuntimeError("GIGACHAT_API_KEY не задан в .env")
    return AsyncOpenAI(
        api_key=settings.gigachat_api_key,
        base_url=BASE_URL,
        timeout=STREAM_TIMEOUT if stream else SHORT_TIMEOUT,
    )


_BASE_PARAMS = dict(
    model=MODEL,
    temperature=0.5,
    presence_penalty=0,
    top_p=0.95,
)

# Гибридные модели Z.ai (GLM-4.5/4.6/4.7) по умолчанию «размышляют» перед
# ответом — для нашего кейса это ест время и токены (вся генерация улетает
# в reasoning_content, а в content остаётся мало). Шлюз cloud.ru игнорирует
# параметр `thinking.type=disabled` из официального API Z.ai, зато пробрасывает
# `chat_template_kwargs.enable_thinking=false` напрямую в vLLM-сервер → это и
# отключает thinking в шаблоне чата модели. Проверено эмпирически: 55с → 7с.
# Для моделей без thinking параметр безобидный (vLLM просто не найдёт ключ).
_EXTRA_BODY = {"chat_template_kwargs": {"enable_thinking": False}}


def _wrap_error(exc: Exception) -> RuntimeError:
    if isinstance(exc, RateLimitError):
        return RuntimeError("LLM перегружен (rate limit). Попробуйте через минуту.")
    if isinstance(exc, APITimeoutError):
        return RuntimeError("LLM не ответил вовремя. Попробуйте ещё раз.")
    if isinstance(exc, APIConnectionError):
        return RuntimeError("Нет связи с LLM-сервисом. Проверьте интернет/настройки.")
    if isinstance(exc, APIError):
        return RuntimeError(f"Ошибка LLM API: {exc}")
    return RuntimeError(f"Непредвиденная ошибка LLM: {exc}")


async def chat_completion(messages: list[dict], max_tokens: int = 2500) -> str:
    """Отправить запрос к GigaChat, вернуть текст ответа."""
    client = _client()
    try:
        response = await client.chat.completions.create(
            messages=messages,
            max_tokens=max_tokens,
            extra_body=_EXTRA_BODY,
            **_BASE_PARAMS,
        )
    except (APIError, APIConnectionError, APITimeoutError, RateLimitError) as exc:
        logger.warning("GigaChat completion failed: %s", exc)
        raise _wrap_error(exc) from exc

    if not response.choices:
        raise RuntimeError("LLM вернул пустой ответ.")
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("LLM вернул пустое содержимое.")
    return content


async def chat_completion_stream(messages: list[dict], max_tokens: int = 4096):
    """Стриминговый вариант — async-генератор текстовых чанков."""
    client = _client(stream=True)
    try:
        stream = await client.chat.completions.create(
            messages=messages,
            max_tokens=max_tokens,
            stream=True,
            extra_body=_EXTRA_BODY,
            **_BASE_PARAMS,
        )
    except (APIError, APIConnectionError, APITimeoutError, RateLimitError) as exc:
        logger.warning("GigaChat stream open failed: %s", exc)
        raise _wrap_error(exc) from exc

    try:
        async for chunk in stream:
            if not chunk.choices:
                continue
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except (APIError, APIConnectionError, APITimeoutError, RateLimitError) as exc:
        logger.warning("GigaChat stream broke mid-flight: %s", exc)
        raise _wrap_error(exc) from exc
