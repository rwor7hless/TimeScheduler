"""Замер скорости LLM-стрима. Запуск: docker compose exec backend python llm_test.py"""
import asyncio
import time

from app.services.gigachat import chat_completion_stream


async def test():
    t0 = time.monotonic()
    first = None
    n = 0
    async for chunk in chat_completion_stream(
        [{"role": "user", "content": "Write a 200-word essay about morning routines."}]
    ):
        if first is None:
            first = time.monotonic() - t0
        n += len(chunk)
    dt = time.monotonic() - t0
    speed = n / dt if dt else 0
    print(f"ttft={first:.2f}s total={dt:.2f}s chars={n} speed={speed:.1f}ch/s")


asyncio.run(test())
