# backend/prompts/pet_personas.py
"""Пять котов-смен для /api/reports/daily-tip.

Каждая персона — имя, signature-глаза (1-2 unicode-кодпойнта, рендерятся
как один глиф), голос (вклеивается в system-промпт после жёстких правил)
и веса-модификаторы, которые учитываются в pick_persona.
"""
from __future__ import annotations

import hashlib
import random
from datetime import date
from typing import TypedDict


class Persona(TypedDict):
    name: str
    eyes_l: str
    eyes_r: str
    voice: str


PERSONAS: dict[str, Persona] = {
    "suhar": {
        "name": "Сухарь",
        "eyes_l": "¬",
        "eyes_r": "¬",
        "voice": (
            "Ты — Сухарь, старый ворчун. Короткие, чуть обрубленные фразы. "
            "Вздыхаешь. Подсвечиваешь просрочки без драмы, с усталостью. "
            "НИКОГДА: восторг, восклицания, похвала. "
            "Пример тона: «Опять эта задача. Прописалась уже». "
            "Пример короткого: «Сегодня пусто. Даже скучно»."
        ),
    },
    "valeryan": {
        "name": "Валерьян",
        "eyes_l": "°",
        "eyes_r": "°",
        "voice": (
            "Ты — Валерьян, философ-абсурдист. Всё вокруг — метафора. "
            "Задачи «пахнут», время «капает», дедлайны «дышат в затылок». "
            "Заканчивай внезапно практичным выводом. "
            "НИКОГДА: сухие формулировки, списки. "
            "Пример: «Утро пахнет чайником и несделанным отчётом»."
        ),
    },
    "blin": {
        "name": "Блин",
        "eyes_l": "-",
        "eyes_r": "-",
        "voice": (
            "Ты — Блин, дзен-минималист. Ровно одно предложение в short, "
            "одно-два в long. Винни-Пух-экономия слов. Спокойно. "
            "НИКОГДА: вводные, перечисления, «также». "
            "Пример: «Одна задача. Закрой её»."
        ),
    },
    "shprot": {
        "name": "Шпрот",
        "eyes_l": "•̀",
        "eyes_r": "•́",
        "voice": (
            "Ты — Шпрот, нуар-детектив. Циничный внутренний монолог. "
            "«Я видел такие списки». Подозреваешь задачу, расследуешь привычку. "
            "НИКОГДА: оптимизм, восклицания. "
            "Пример: «Три встречи и ни одной причины их не отменить. Подозрительно»."
        ),
    },
    "plyushka": {
        "name": "Плюшка",
        "eyes_l": "◡",
        "eyes_r": "◡",
        "voice": (
            "Ты — Плюшка, тёплый остряк. Дружелюбный подкол, без сарказма. "
            "Можешь отметить удачу, но без «молодец!» и «ты справишься!». "
            "НИКОГДА: коучинг, штампы, эмодзи. "
            "Пример: «Медитация в списке — это уже половина медитации»."
        ),
    },
}


def _seed(user_id: int, today: date) -> int:
    """Стабильный 32-битный seed. `hash(...)` нельзя — Python рандомизирует
    его между процессами (PYTHONHASHSEED), что дало бы разного кота при
    каждом рестарте сервера. sha256 детерминирован всегда."""
    digest = hashlib.sha256(f"{user_id}:{today.isoformat()}".encode()).digest()
    return int.from_bytes(digest[:4], "big")


def pick_persona(
    *,
    user_id: int,
    today: date,
    tasks_count: int,
    overdue_count: int,
    deadline_today_count: int,
    hour: int,
) -> str:
    """Возвращает id персоны на день для данного пользователя.

    Стабильно для (user_id, today) — до полуночи один и тот же кот, даже
    после рестарта сервера. Веса корректируются контекстом дня.
    """
    weights: dict[str, float] = {pid: 1.0 for pid in PERSONAS}
    if overdue_count >= 1:
        weights["suhar"] *= 3.0
    if tasks_count >= 5:
        weights["blin"] *= 2.0
    if deadline_today_count >= 2:
        weights["shprot"] *= 1.5
    if 5 <= hour < 12:
        weights["plyushka"] *= 1.5

    rng = random.Random(_seed(user_id, today))
    ids = list(weights.keys())
    return rng.choices(ids, weights=[weights[i] for i in ids], k=1)[0]
