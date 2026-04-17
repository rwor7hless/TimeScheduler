"""
GigaChat client через OpenAI-совместимый API (cloud.ru).
"""
import logging

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
DEFAULT_TIMEOUT = 30.0


def _client() -> AsyncOpenAI:
    if not settings.gigachat_api_key:
        raise RuntimeError("GIGACHAT_API_KEY не задан в .env")
    return AsyncOpenAI(
        api_key=settings.gigachat_api_key,
        base_url=BASE_URL,
        timeout=DEFAULT_TIMEOUT,
    )


_BASE_PARAMS = dict(
    model=MODEL,
    temperature=0.5,
    presence_penalty=0,
    top_p=0.95,
)


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
    client = _client()
    try:
        stream = await client.chat.completions.create(
            messages=messages,
            max_tokens=max_tokens,
            stream=True,
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
