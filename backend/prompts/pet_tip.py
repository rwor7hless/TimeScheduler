# backend/prompts/pet_tip.py
"""Сборка промпта для /api/reports/daily-tip.

SYSTEM_HEAD содержит жёсткие правила формата (JSON {short, long}, длины,
запреты). Персона-голос приклеивается ниже и меняет тон, но не формат.
"""
from prompts.pet_personas import PERSONAS


SYSTEM_HEAD = """\
Ты — один из пяти котов-смен в приложении продуктивности.
Какой именно — скажет блок ниже.

━━━ ЖЁСТКИЕ ПРАВИЛА ━━━
1. Формат ответа: строго JSON вида
   {"short": "...", "long": "..."}
   Никакого текста до/после, никакого markdown-обрамления, никаких ```.
2. Длина:
   - short: 1 предложение, не более 100 символов.
   - long:  1–2 предложения, не более 260 символов.
   long развивает ту же мысль, что short, добавляя ОДНО пояснение,
   следствие или совет. Это не цитата short — это его продолжение
   в том же голосе.
3. Обращение: на «ты», от первого лица (я-кот).
4. Язык: живой. Без пафоса, коучинга, фраз-штампов:
   «желаю успехов», «удачи», «ты справишься», «верю в тебя»,
   «продуктивного дня», «сегодня отличный день», «молодец».
5. Если в данных есть дедлайн сегодня или просрочка — упомяни её
   конкретно по названию (в кавычках), но без драмы.
6. Если задач нет — не выдумывай. Скажи это прямо, коротко, в характере.
7. Опирайся ТОЛЬКО на данные в user-сообщении. Никакого markdown, эмодзи.
"""


def build_pet_prompt(
    persona_id: str,
    tasks: list[str],
    habits: list[str],
    deadline_today: list[str],
    overdue: list[str],
) -> list[dict]:
    """Возвращает messages для chat/completions: [system, user].

    persona_id — ключ из PERSONAS; голос персоны вклеивается в system.
    """
    persona = PERSONAS[persona_id]
    system = SYSTEM_HEAD + "\n━━━ ТВОЯ ПЕРСОНА ━━━\n" + persona["voice"]

    data_lines: list[str] = []
    if tasks:
        data_lines.append(
            "Задачи на сегодня (My Day / расписание): "
            + ", ".join(f'«{t}»' for t in tasks)
        )
    else:
        data_lines.append("Задач в My Day или расписании нет.")
    if deadline_today:
        data_lines.append(
            "Дедлайн сегодня: " + ", ".join(f'«{t}»' for t in deadline_today)
        )
    if overdue:
        data_lines.append(
            "Просроченные задачи (давно висят): "
            + ", ".join(f'«{t}»' for t in overdue)
        )
    if habits:
        data_lines.append("Привычки: " + ", ".join(habits))

    user_content = (
        "━━━ ДАННЫЕ ━━━\n"
        + "\n".join(data_lines)
        + "\n\n"
        'Ответь JSON-ом {"short": "...", "long": "..."} в голосе персоны '
        "из system-сообщения. Без markdown, без эмодзи, без штампов."
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]
