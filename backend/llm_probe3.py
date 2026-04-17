"""Тест скорости на разных моделях cloud.ru с enable_thinking=False."""
import asyncio
import os
import time
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

import httpx
from openai import AsyncOpenAI

API_KEY = os.environ["GIGACHAT_API_KEY"]
BASE_URL = "https://foundation-models.api.cloud.ru/v1"
EXTRA = {"chat_template_kwargs": {"enable_thinking": False}}
PROMPT = "Напиши в 3-4 предложениях совет про планирование недели."


async def list_models():
    client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)
    r = await client.models.list()
    return [m.id for m in r.data]


async def probe(model: str):
    client = AsyncOpenAI(
        api_key=API_KEY, base_url=BASE_URL,
        timeout=httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0),
    )
    print(f"\n-- {model}")
    t0 = time.monotonic()
    first = None
    cc = rc = 0
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": PROMPT}],
            max_tokens=1500, temperature=0.5, stream=True,
            extra_body=EXTRA,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            d = chunk.choices[0].delta
            if first is None:
                first = time.monotonic() - t0
            if getattr(d, "content", None):
                cc += len(d.content)
            if getattr(d, "reasoning_content", None):
                rc += len(d.reasoning_content)
    except Exception as e:
        print(f"   error: {type(e).__name__}: {e}")
        return
    dt = time.monotonic() - t0
    speed = cc / dt if dt else 0
    print(f"   ttft={first:.2f}s total={dt:.2f}s content={cc} reasoning={rc} speed={speed:.1f}ch/s")


async def main():
    models = await list_models()
    print("=== Available models on cloud.ru ===")
    for m in models:
        print(f"  {m}")

    # Тестируем только то, что похоже на GigaChat / GLM
    for m in models:
        low = m.lower()
        if "gigachat" in low or "glm-4.7" in low or "glm-4.5" in low:
            await probe(m)


asyncio.run(main())
