"""
LLM-клиент через OpenAI-совместимый API.

Несмотря на имя модуля, поддерживает несколько провайдеров:
  - LLM_PROVIDER=gigachat → cloud.ru (foundation-models) с GigaChat3
  - LLM_PROVIDER=nvidia   → NVIDIA NIM (integrate.api.nvidia.com)

Оба провайдера реализуют OpenAI-совместимый `/v1/chat/completions`, поэтому
один и тот же `AsyncOpenAI` клиент работает с обоими — разница только в
base_url, api_key и имени модели.

Публичные функции (`chat_completion`, `chat_completion_stream`) не меняют
сигнатур при смене провайдера.
"""
import logging
import time
from dataclasses import dataclass

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


@dataclass(frozen=True)
class ProviderConfig:
    name: str          # человекочитаемое имя для логов/ошибок
    base_url: str
    api_key: str       # резолвится из settings
    model: str
    key_env_name: str  # имя переменной окружения — для понятных сообщений об ошибках


def _resolve_provider() -> ProviderConfig:
    """Построить конфиг текущего провайдера из settings."""
    p = settings.llm_provider
    if p == "nvidia":
        return ProviderConfig(
            name="NVIDIA NIM",
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=settings.nvidia_api_key,
            model=settings.nvidia_model,
            key_env_name="NVIDIA_API_KEY",
        )
    # default / gigachat
    return ProviderConfig(
        name="GigaChat (cloud.ru)",
        base_url="https://foundation-models.api.cloud.ru/v1",
        api_key=settings.gigachat_api_key,
        model=settings.gigachat_model,
        key_env_name="GIGACHAT_API_KEY",
    )


def llm_available() -> bool:
    """Есть ли ключ для текущего провайдера."""
    return bool(_resolve_provider().api_key)


def llm_unavailable_reason() -> str | None:
    """Короткое сообщение о том, почему LLM недоступен, или None если всё ок."""
    cfg = _resolve_provider()
    if not cfg.api_key:
        return (
            f"LLM отключён в конфигурации: задайте {cfg.key_env_name} в .env "
            f"(текущий провайдер — {cfg.name})."
        )
    return None


def llm_info() -> dict[str, str]:
    """Краткая справка о текущем провайдере — удобно для логов на старте."""
    cfg = _resolve_provider()
    return {"provider": cfg.name, "model": cfg.model, "base_url": cfg.base_url}


# Нестримовый клиент: жёсткий таймаут на весь запрос (короткие ответы типа daily-tip).
SHORT_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=30.0, pool=10.0)
# Стримовый клиент: read=None, иначе httpx порубит середину генерации.
# connect/write остаются жёсткими — если сеть мертва, это видно сразу.
STREAM_TIMEOUT = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0)


def _client(cfg: ProviderConfig, *, stream: bool = False) -> AsyncOpenAI:
    if not cfg.api_key:
        raise RuntimeError(
            f"{cfg.key_env_name} не задан в .env (провайдер: {cfg.name})"
        )
    return AsyncOpenAI(
        api_key=cfg.api_key,
        base_url=cfg.base_url,
        timeout=STREAM_TIMEOUT if stream else SHORT_TIMEOUT,
    )


_BASE_PARAMS = dict(
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


def _prompt_chars(messages: list[dict]) -> int:
    """Грубая оценка объёма запроса — сумма длин контента сообщений."""
    return sum(len(str(m.get("content", ""))) for m in messages)


async def chat_completion(messages: list[dict], max_tokens: int = 2500) -> str:
    """Отправить запрос к LLM, вернуть текст ответа."""
    cfg = _resolve_provider()
    client = _client(cfg)
    logger.info(
        "LLM call: provider=%s model=%s messages=%d prompt_chars=%d max_tokens=%d",
        cfg.name, cfg.model, len(messages), _prompt_chars(messages), max_tokens,
    )
    t0 = time.monotonic()
    try:
        response = await client.chat.completions.create(
            messages=messages,
            max_tokens=max_tokens,
            model=cfg.model,
            **_BASE_PARAMS,
        )
    except (APIError, APIConnectionError, APITimeoutError, RateLimitError) as exc:
        logger.warning(
            "LLM call failed after %.2fs: provider=%s model=%s err=%s",
            time.monotonic() - t0, cfg.name, cfg.model, exc,
        )
        raise _wrap_error(exc) from exc

    if not response.choices:
        raise RuntimeError("LLM вернул пустой ответ.")
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("LLM вернул пустое содержимое.")
    logger.info(
        "LLM call done in %.2fs: provider=%s model=%s response_chars=%d",
        time.monotonic() - t0, cfg.name, cfg.model, len(content),
    )
    return content


async def chat_completion_stream(messages: list[dict], max_tokens: int = 4096):
    """Стриминговый вариант — async-генератор текстовых чанков."""
    cfg = _resolve_provider()
    client = _client(cfg, stream=True)
    logger.info(
        "LLM stream call: provider=%s model=%s messages=%d prompt_chars=%d max_tokens=%d",
        cfg.name, cfg.model, len(messages), _prompt_chars(messages), max_tokens,
    )
    t0 = time.monotonic()
    try:
        stream = await client.chat.completions.create(
            messages=messages,
            max_tokens=max_tokens,
            model=cfg.model,
            stream=True,
            **_BASE_PARAMS,
        )
    except (APIError, APIConnectionError, APITimeoutError, RateLimitError) as exc:
        logger.warning(
            "LLM stream open failed after %.2fs: provider=%s model=%s err=%s",
            time.monotonic() - t0, cfg.name, cfg.model, exc,
        )
        raise _wrap_error(exc) from exc

    try:
        async for chunk in stream:
            if not chunk.choices:
                continue
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except (APIError, APIConnectionError, APITimeoutError, RateLimitError) as exc:
        logger.warning(
            "LLM stream broke mid-flight after %.2fs: provider=%s model=%s err=%s",
            time.monotonic() - t0, cfg.name, cfg.model, exc,
        )
        raise _wrap_error(exc) from exc
