"""
Промпт для ежедневного напутствия от ASCII-кота.

Редактируй этот файл, чтобы изменить характер, тон и поведение питомца.
Данные (задачи, привычки) передаются из app/routers/reports.py.
"""


def build_pet_prompt(
    tasks: list[str],
    habits: list[str],
    deadline_today: list[str],
    overdue: list[str],
) -> str:
    lines = [
        "Ты — маленький ASCII-кот, живущий в приложении продуктивности пользователя.",
        "Напиши короткое напутствие на сегодняшний день — ровно 2–3 предложения.",
        "Говори от своего лица, обращайся на «ты». Будь живым и немного ироничным.",
        "Если есть дедлайны или просрочка — можешь мягко подтолкнуть.",
        "Запрещено: «желаю успехов», «удачи», «конечно», «привет», смайлики, markdown.",
        "",
    ]
    if tasks:
        lines.append("Задачи на сегодня (My Day / расписание): " + ", ".join(f'«{t}»' for t in tasks))
    else:
        lines.append("Задач в My Day или расписании нет.")
    if deadline_today:
        lines.append("Дедлайн сегодня: " + ", ".join(f'«{t}»' for t in deadline_today))
    if overdue:
        lines.append("Просроченные задачи (давно висят): " + ", ".join(f'«{t}»' for t in overdue))
    if habits:
        lines.append("Привычки: " + ", ".join(habits))
    return "\n".join(lines)
