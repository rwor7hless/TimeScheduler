"""
Вторая попытка: проверяем разные способы отключить thinking через cloud.ru шлюз,
и смотрим, можно ли вообще получить content.
"""
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
MODEL = "zai-org/GLM-4.7-Flash"


async def probe(label: str, messages, extra_body=None, max_tokens=1500):
    client = AsyncOpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
        timeout=httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0),
    )
    kwargs = dict(
        model=MODEL, messages=messages, max_tokens=max_tokens,
        temperature=0.5, stream=True,
    )
    if extra_body:
        kwargs["extra_body"] = extra_body

    print(f"\n-- {label}")
    t0 = time.monotonic()
    first = None
    cc = 0
    rc = 0
    try:
        stream = await client.chat.completions.create(**kwargs)
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
    print(f"   ttft={first:.2f}s total={dt:.2f}s content={cc} reasoning={rc}")


PROMPT = "Напиши в 3-4 предложениях совет про планирование недели."
msgs_plain = [{"role": "user", "content": PROMPT}]
msgs_sys = [
    {"role": "system", "content": "Отвечай сразу, без рассуждений."},
    {"role": "user", "content": PROMPT},
]
msgs_prefix = [{"role": "user", "content": f"/nothink {PROMPT}"}]
msgs_no_think = [{"role": "user", "content": f"/no_think\n{PROMPT}"}]


async def main():
    # Увеличенный max_tokens — хватит на thinking + ответ
    await probe("plain + max_tokens=1500 (смотрим, появится ли content)", msgs_plain, max_tokens=1500)
    await probe("thinking=disabled (extra_body)", msgs_plain, {"thinking": {"type": "disabled"}}, 1500)
    await probe("enable_thinking=False (extra_body)", msgs_plain, {"enable_thinking": False}, 1500)
    await probe("chat_template_kwargs={enable_thinking:false}", msgs_plain,
                {"chat_template_kwargs": {"enable_thinking": False}}, 1500)
    await probe("system: 'не рассуждай'", msgs_sys, max_tokens=1500)
    await probe("prefix /nothink", msgs_prefix, max_tokens=1500)
    await probe("prefix /no_think", msgs_no_think, max_tokens=1500)


asyncio.run(main())
