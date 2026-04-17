"""
Минимальный прямой тест API cloud.ru / GLM-4.7-Flash.
Пишет ttft, скорость, и проверяет что thinking реально выключен.
"""
import asyncio
import os
import sys
import time
from pathlib import Path

# Подхватываем .env из корня репо (один уровень выше backend/)
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

API_KEY = os.environ.get("GIGACHAT_API_KEY", "")
if not API_KEY:
    print("GIGACHAT_API_KEY пуст — проверь .env")
    sys.exit(1)

BASE_URL = "https://foundation-models.api.cloud.ru/v1"
MODEL = "zai-org/GLM-4.7-Flash"
PROMPT = "Write a 200-word essay about morning routines in Russian."


async def run(label: str, extra_body: dict | None):
    client = AsyncOpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
        timeout=httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0),
    )
    kwargs = dict(
        model=MODEL,
        messages=[{"role": "user", "content": PROMPT}],
        max_tokens=800,
        temperature=0.5,
        stream=True,
    )
    if extra_body is not None:
        kwargs["extra_body"] = extra_body

    print(f"\n── {label} ─────────────────────")
    t0 = time.monotonic()
    try:
        stream = await client.chat.completions.create(**kwargs)
    except Exception as e:
        print(f"  open failed: {type(e).__name__}: {e}")
        return

    first = None
    content_chars = 0
    reasoning_chars = 0
    saw_reasoning = False

    try:
        async for chunk in stream:
            if not chunk.choices:
                continue
            d = chunk.choices[0].delta
            if first is None:
                first = time.monotonic() - t0
            c = getattr(d, "content", None)
            r = getattr(d, "reasoning_content", None)
            if c:
                content_chars += len(c)
            if r:
                reasoning_chars += len(r)
                saw_reasoning = True
    except Exception as e:
        print(f"  stream broke: {type(e).__name__}: {e}")
        return

    dt = time.monotonic() - t0
    speed = content_chars / dt if dt else 0
    print(f"  ttft           = {first:.2f}s" if first else "  ttft           = (no chunks)")
    print(f"  total          = {dt:.2f}s")
    print(f"  content chars  = {content_chars}")
    print(f"  reasoning chars= {reasoning_chars}  (thinking вернулось: {saw_reasoning})")
    print(f"  speed          = {speed:.1f} ch/s")


async def main():
    print(f"Model: {MODEL}")
    print(f"Base : {BASE_URL}")
    print(f"Key  : {API_KEY[:10]}...")

    # 1) Как у нас в коде — thinking disabled
    await run("thinking=disabled (как в проде)", {"thinking": {"type": "disabled"}})
    # 2) Для сравнения — без extra_body, пусть модель сама решает
    await run("без extra_body (default)", None)


asyncio.run(main())
