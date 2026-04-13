"""
Seed script — заполняет БД фиктивными данными для разработки.
Запуск: docker compose exec backend python seed.py
"""
import asyncio
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text

from app.config import settings
from app.database import async_session
from app.models.board import Board
from app.models.habit import Habit
from app.models.habit_log import HabitLog
from app.models.task import KanbanStatus, Priority, Tag, Task, task_tags
from app.models.user import User

NOW = datetime.now(timezone.utc)
TODAY = date.today()


def at(h: int, m: int = 0) -> datetime:
    return datetime(NOW.year, NOW.month, NOW.day, h, m, tzinfo=timezone.utc)


def ahead(days: int) -> datetime:
    return NOW + timedelta(days=days)


BOARDS = ["Работа", "Учёба", "Личное", "Здоровье"]

TAGS_DATA = [
    ("важно",   "#EF4444"),
    ("срочно",  "#F97316"),
    ("идея",    "#8B5CF6"),
    ("беклог",  "#6B7280"),
    ("ревью",   "#3B82F6"),
    ("дом",     "#10B981"),
]

HABITS_DATA = [
    ("Зарядка",    "#F59E0B", "10 минут с утра"),
    ("Чтение",     "#8B5CF6", "30 страниц в день"),
    ("Медитация",  "#06B6D4", "5–10 минут тишины"),
    ("Вода 2 л",   "#10B981", "2 литра воды в день"),
    ("Бег",        "#EF4444", "3 км или 30 минут"),
    ("Без соцсетей до 12:00", "#6366F1", "Телефон убрать до полудня"),
]

# (title, priority, status, board_name|None, color, scheduled_start|None, my_day, repeat_days, description, deadline_days|None)
TASKS_DATA = [
    # ── My Day ────────────────────────────────────────────────────────────────
    ("Написать отчёт за квартал",     "high",   "in_progress", "Работа",  "#EF4444", None,     True,  None,        "PDF для руководства",             2),
    ("Встреча с командой в 15:00",    "urgent", "todo",        "Работа",  "#F97316", at(15),   True,  None,        "Sync по Q2 роадмапу",             0),
    ("Покупки в магазин",             "low",    "todo",        None,      "#10B981", None,     True,  None,        "Молоко, хлеб, яйца, масло",       None),

    # ── Расписание сегодня ────────────────────────────────────────────────────
    ("Стэндап",                       "medium", "done",        "Работа",  "#3B82F6", at(10),   False, None,        "Ежедневный утренний стэндап",     None),
    ("Ланч",                          "low",    "todo",        None,      "#84CC16", at(13),   False, None,        None,                              None),
    ("Английский с репетитором",      "medium", "todo",        "Учёба",   "#8B5CF6", at(19,30),False, None,        "Unit 7 — Past Perfect",           None),

    # ── Повторяющиеся ─────────────────────────────────────────────────────────
    ("Проверить почту",               "low",    "todo",        "Работа",  "#6B7280", at(9),    False, [0,1,2,3,4], None,                              None),
    ("Вечерний обзор дня",            "medium", "todo",        None,      "#06B6D4", at(21),   False, [0,1,2,3,4,5,6], "5 минут на рефлексию",        None),

    # ── Беклог — Работа ──────────────────────────────────────────────────────
    ("Рефакторинг модуля авторизации","high",   "todo",        "Работа",  "#3B82F6", None,     False, None,        "JWT-логику в отдельный сервис",   5),
    ("Написать тесты для API задач",  "medium", "todo",        "Работа",  "#06B6D4", None,     False, None,        "Покрытие ≥ 80%",                  None),
    ("Code review PR #42",            "high",   "in_progress", "Работа",  "#F59E0B", None,     False, None,        "Новый endpoint для экспорта",     1),
    ("Обновить Dockerfile",           "low",    "todo",        "Работа",  "#6B7280", None,     False, None,        None,                              None),
    ("Настроить CI/CD pipeline",      "medium", "todo",        "Работа",  "#8B5CF6", None,     False, None,        "GitHub Actions + автодеплой",     None),
    ("Ревью архитектуры микросервисов","high",  "todo",        "Работа",  "#EF4444", None,     False, None,        "Проверить схему взаимодействия",  7),

    # ── Беклог — Учёба ───────────────────────────────────────────────────────
    ("Прочитать главу про asyncio",   "medium", "todo",        "Учёба",   "#8B5CF6", None,     False, None,        "Python Concurrency with asyncio", None),
    ("Решить 5 задач на LeetCode",    "low",    "todo",        "Учёба",   "#10B981", None,     False, None,        "Medium: деревья и графы",         None),
    ("Конспект лекции по ML",         "medium", "in_progress", "Учёба",   "#F97316", None,     False, None,        "Линейная регрессия, градиент",    None),
    ("Сдать домашку по статистике",   "high",   "todo",        "Учёба",   "#EF4444", None,     False, None,        None,                              3),

    # ── Беклог — Личное ──────────────────────────────────────────────────────
    ("Записаться к стоматологу",      "medium", "todo",        "Личное",  "#EF4444", None,     False, None,        None,                              None),
    ("Обновить CV",                   "low",    "todo",        "Личное",  "#6B7280", None,     False, None,        "Добавить последние проекты",      None),
    ("Выбрать подарок на ДР",         "medium", "todo",        "Личное",  "#EC4899", None,     False, None,        "Бюджет до 3000 ₽",                6),
    ("Разобрать зимние вещи",         "low",    "todo",        "Личное",  "#84CC16", None,     False, None,        None,                              None),

    # ── Беклог — Здоровье ────────────────────────────────────────────────────
    ("Записаться в зал",              "medium", "todo",        "Здоровье","#F59E0B", None,     False, None,        None,                              None),
    ("Сдать анализы крови",           "high",   "todo",        "Здоровье","#EF4444", None,     False, None,        "Натощак, с 8 до 10",              10),
    ("Купить витамины D3 и Mg",       "low",    "todo",        "Здоровье","#10B981", None,     False, None,        None,                              None),
]

# индекс задачи → список тегов
TASK_TAGS = {
    0:  ["важно"],
    1:  ["срочно", "важно"],
    8:  ["беклог", "идея"],
    9:  ["беклог"],
    10: ["ревью", "срочно"],
    12: ["идея"],
    13: ["важно", "ревью"],
    18: ["дом"],
}


async def main() -> None:
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.username == settings.user_login)
        )
        user = result.scalar_one_or_none()
        if not user:
            print(f"[!] Пользователь '{settings.user_login}' не найден — сначала запусти бэкенд.")
            return

        uid = user.id
        print(f"[+] Пользователь: {user.username} (id={uid})")

        # Очистить старые данные (каскады уберут логи и task_tags сами)
        await session.execute(text("DELETE FROM habits WHERE user_id = :uid"), {"uid": uid})
        await session.execute(text("DELETE FROM tasks WHERE user_id = :uid"), {"uid": uid})
        await session.execute(text("DELETE FROM boards WHERE user_id = :uid"), {"uid": uid})
        await session.execute(text("DELETE FROM tags WHERE user_id = :uid"), {"uid": uid})
        await session.commit()
        print("[+] Старые данные очищены")

        # Теги
        tags_map: dict[str, Tag] = {}
        for name, color in TAGS_DATA:
            tag = Tag(user_id=uid, name=name, color=color)
            session.add(tag)
            tags_map[name] = tag
        await session.flush()
        print(f"[+] Теги: {len(tags_map)}")

        # Доски
        boards_map: dict[str, Board] = {}
        for name in BOARDS:
            board = Board(user_id=uid, name=name)
            session.add(board)
            boards_map[name] = board
        await session.flush()
        print(f"[+] Доски: {len(boards_map)}")

        # Задачи
        task_objs: list[Task] = []
        for i, row in enumerate(TASKS_DATA):
            title, priority, status, board_name, color, sched, my_day, repeat, desc, dl_days = row
            task = Task(
                user_id=uid,
                title=title,
                priority=Priority(priority),
                status=KanbanStatus(status),
                color=color,
                description=desc,
                board_id=boards_map[board_name].id if board_name else None,
                scheduled_start=sched,
                repeat_days=repeat,
                my_day=my_day,
                deadline=ahead(dl_days) if dl_days is not None else None,
                kanban_order=i,
                completed_at=NOW - timedelta(hours=1) if status == "done" else None,
            )
            session.add(task)
            task_objs.append(task)
        await session.flush()
        print(f"[+] Задачи: {len(task_objs)}")

        # Теги → задачи
        for task_idx, tag_names in TASK_TAGS.items():
            task = task_objs[task_idx]
            for name in tag_names:
                await session.execute(
                    task_tags.insert().values(task_id=task.id, tag_id=tags_map[name].id)
                )
        await session.flush()

        # Привычки + логи за 60 дней (~70% выполнения)
        for name, color, desc in HABITS_DATA:
            habit = Habit(user_id=uid, name=name, color=color, description=desc, is_active=True)
            session.add(habit)
            await session.flush()
            for days_ago in range(60):
                if random.random() < 0.70:
                    log_date = TODAY - timedelta(days=days_ago)
                    session.add(HabitLog(habit_id=habit.id, date=log_date))
        await session.flush()
        print(f"[+] Привычки: {len(HABITS_DATA)}")

        await session.commit()
        print("\n✓ Готово!")


if __name__ == "__main__":
    asyncio.run(main())
