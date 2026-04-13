"""
GigaChat client через OpenAI-совместимый API (cloud.ru).
"""
import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://foundation-models.api.cloud.ru/v1"
MODEL = "ai-sage/GigaChat3-10B-A1.8B"


def _client() -> AsyncOpenAI:
    if not settings.gigachat_api_key:
        raise RuntimeError("GIGACHAT_API_KEY не задан в .env")
    return AsyncOpenAI(api_key=settings.gigachat_api_key, base_url=BASE_URL)


_BASE_PARAMS = dict(
    model=MODEL,
    temperature=0.5,
    presence_penalty=0,
    top_p=0.95,
)


async def chat_completion(messages: list[dict], max_tokens: int = 2500) -> str:
    """Отправить запрос к GigaChat, вернуть текст ответа."""
    client = _client()
    response = await client.chat.completions.create(
        messages=messages,
        max_tokens=max_tokens,
        **_BASE_PARAMS,
    )
    return response.choices[0].message.content


async def chat_completion_stream(messages: list[dict], max_tokens: int = 4096):
    """Стриминговый вариант — async-генератор текстовых чанков."""
    client = _client()
    stream = await client.chat.completions.create(
        messages=messages,
        max_tokens=max_tokens,
        stream=True,
        **_BASE_PARAMS,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        content = chunk.choices[0].delta.content
        if content:
            yield content
