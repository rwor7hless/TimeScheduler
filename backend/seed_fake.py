"""
Fake data seeder for TimeScheduler demo / development.

Usage:
    cd backend
    python seed_fake.py            # append to current data for first user
    python seed_fake.py --user 2   # append for a specific user id

Generates:
  * 5 budget tags
  * ~6 monthly allocations
  * 5 planned purchases (current + next month)
  * 3 recurring templates (аренда / подписки)
  * ~220 transactions spread over the last 90 days
  * 3 kanban boards with 9 tasks (mix of statuses/priorities/dates)
  * 3 habits with ~3 weeks of logs

The script is additive. To wipe first, run the app with CLEAN_DB_ON_STARTUP=true.
"""

from __future__ import annotations

import asyncio
import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable

from sqlalchemy import select

from app.database import async_session
from app.models.board import Board
from app.models.budget import (
    BudgetAllocation,
    BudgetTag,
    PlannedPurchase,
    RecurringTransaction,
    Transaction,
)
from app.models.habit import Habit
from app.models.habit_log import HabitLog
from app.models.task import KanbanStatus, Priority, Task
from app.models.user import User


RNG = random.Random(42)  # stable-ish randomness so repeated runs stay comparable

# ─── Tag palette ──────────────────────────────────────────────────────────────

DEMO_TAGS: list[tuple[str, str]] = [
    ("работа", "#3B82F6"),
    ("семья", "#EC4899"),
    ("путешествие", "#F59E0B"),
    ("подписки", "#8B5CF6"),
    ("здоровье", "#10B981"),
]

# ─── Category → realistic (amount_range, description) samples ────────────────

CATEGORY_PROFILES: dict[str, tuple[int, tuple[int, int], list[str]]] = {
    # category_id: (weight, (min, max), descriptions)
    "food":          (40, (180, 2600), [
        "Продукты в Пятёрочке", "Продукты во Вкусвилле", "Обед в кафе", "Кофе на вынос",
        "Ужин с друзьями", "Завтрак", "Пицца", "Суши", "Бар", "Доставка еды",
        "Шаверма", "Перекус", "Выпечка",
    ]),
    "transport":     (15, (80, 900), [
        "Метро", "Автобус", "Такси Яндекс", "Заправка", "Парковка", "Bolt", "Проездной",
    ]),
    "housing":       (4, (180, 1800), [
        "Электричество", "Интернет", "Вода", "Мобильная связь", "Бытовая химия",
    ]),
    "health":        (3, (450, 5200), [
        "Аптека", "Приём у врача", "Анализы", "Витамины", "Стоматолог",
    ]),
    "entertainment": (10, (400, 3800), [
        "Кино", "Концерт", "Бар с друзьями", "Настольная игра", "Боулинг",
        "Театр", "Квест",
    ]),
    "clothing":      (5, (900, 12000), [
        "Футболка", "Кроссовки", "Джинсы", "Куртка", "Толстовка",
    ]),
    "tech":          (2, (2500, 42000), [
        "Клавиатура", "Наушники", "Кабель USB-C", "Монитор", "Батарейки",
    ]),
    "education":     (3, (500, 8500), [
        "Книга", "Курс на Coursera", "Онлайн-учебник", "Репетитор",
    ]),
    "travel":        (2, (2500, 45000), [
        "Билет на поезд", "Бронь отеля", "Авиабилет", "Такси в аэропорт",
    ]),
    "subscriptions": (4, (199, 1290), [
        "Spotify", "Netflix", "YouTube Premium", "iCloud", "ChatGPT Plus",
    ]),
    "other":         (5, (200, 3500), [
        "Подарок", "Донат", "Химчистка", "Мелочи",
    ]),
}

INCOME_PROFILES: list[tuple[str, tuple[int, int]]] = [
    ("Зарплата", (85000, 110000)),
    ("Аванс", (40000, 60000)),
    ("Кэшбэк", (150, 1200)),
    ("Перевод от друга", (500, 5000)),
]


def _weighted_choice(profiles: dict[str, tuple[int, tuple[int, int], list[str]]]) -> str:
    total = sum(p[0] for p in profiles.values())
    roll = RNG.uniform(0, total)
    acc = 0.0
    for cat, (weight, _, _) in profiles.items():
        acc += weight
        if roll <= acc:
            return cat
    return next(iter(profiles))  # fallback


def _round_amount(n: float) -> float:
    # make numbers look human: round to 10 ₽, occasionally to 100 ₽
    base = 100 if n > 5000 else 10
    return round(n / base) * base


async def _pick_user(db, user_id: int | None) -> User:
    if user_id is not None:
        u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if u is None:
            raise SystemExit(f"User {user_id} not found")
        return u
    u = (await db.execute(select(User).order_by(User.id))).scalars().first()
    if u is None:
        raise SystemExit("No users in DB — start the app once to create admin")
    return u


async def seed_tags(db, user: User) -> list[BudgetTag]:
    existing_names = {
        r[0]
        for r in (
            await db.execute(select(BudgetTag.name).where(BudgetTag.user_id == user.id))
        ).all()
    }
    created: list[BudgetTag] = []
    for name, color in DEMO_TAGS:
        if name in existing_names:
            continue
        tag = BudgetTag(user_id=user.id, name=name, color=color)
        db.add(tag)
        created.append(tag)
    await db.flush()
    for t in created:
        await db.refresh(t)

    all_tags = (
        await db.execute(select(BudgetTag).where(BudgetTag.user_id == user.id))
    ).scalars().all()
    return list(all_tags)


async def seed_allocations(db, user: User) -> None:
    today = date.today()
    y, m0 = today.year, today.month - 1
    limits = {
        "food": 25000,
        "transport": 8000,
        "housing": 55000,
        "entertainment": 10000,
        "subscriptions": 3000,
        "clothing": 15000,
    }

    existing = (
        await db.execute(
            select(BudgetAllocation.category).where(
                BudgetAllocation.user_id == user.id,
                BudgetAllocation.year == y,
                BudgetAllocation.month == m0,
            )
        )
    ).all()
    existing_set = {row[0] for row in existing}

    for cat, amount in limits.items():
        if cat in existing_set:
            continue
        db.add(BudgetAllocation(
            user_id=user.id, year=y, month=m0, category=cat, limit_amount=float(amount),
        ))


async def seed_planned(db, user: User) -> None:
    today = date.today()
    y, m0 = today.year, today.month - 1
    next_m0 = (m0 + 1) % 12
    next_y = y if m0 < 11 else y + 1

    items = [
        (y, m0, "Новая клавиатура", 8000, "tech"),
        (y, m0, "Велокаска", 12000, "travel"),
        (y, m0, "Подарок маме", 3500, "other"),
        (next_y, next_m0, "Курс по дизайну", 15000, "education"),
        (next_y, next_m0, "Ремонт в ванной", 28000, "housing"),
    ]

    for yr, mon, desc, amt, cat in items:
        exists = (
            await db.execute(
                select(PlannedPurchase.id).where(
                    PlannedPurchase.user_id == user.id,
                    PlannedPurchase.year == yr,
                    PlannedPurchase.month == mon,
                    PlannedPurchase.description == desc,
                )
            )
        ).first()
        if exists:
            continue
        db.add(PlannedPurchase(
            user_id=user.id, year=yr, month=mon, amount=float(amt),
            category=cat, description=desc, done=False,
        ))


async def seed_recurring(db, user: User) -> None:
    today = date.today()
    start = (today - timedelta(days=120)).isoformat()

    items = [
        ("expense", 50000, "housing", "Аренда квартиры", 1),
        ("expense", 299, "subscriptions", "Spotify", 15),
        ("expense", 799, "subscriptions", "Netflix", 20),
    ]

    existing_descriptions = {
        r[0]
        for r in (
            await db.execute(
                select(RecurringTransaction.description).where(
                    RecurringTransaction.user_id == user.id
                )
            )
        ).all()
    }

    for tx_type, amount, cat, desc, dom in items:
        if desc in existing_descriptions:
            continue
        db.add(RecurringTransaction(
            user_id=user.id, type=tx_type, amount=float(amount), category=cat,
            description=desc, tag_ids=[], day_of_month=dom,
            start_date=start, end_date=None, last_generated_date=None, is_paused=False,
        ))


async def seed_transactions(db, user: User, tags: list[BudgetTag]) -> int:
    today = date.today()
    created_count = 0

    for day_offset in range(90):
        day = today - timedelta(days=day_offset)
        day_str = day.isoformat()

        # Higher volume on weekends for food/entertainment; otherwise weekday mix
        is_weekend = day.weekday() >= 5
        count_range = (1, 5) if is_weekend else (0, 4)
        n = RNG.randint(*count_range)

        for _ in range(n):
            cat = _weighted_choice(CATEGORY_PROFILES)
            weight, (lo, hi), descs = CATEGORY_PROFILES[cat]
            del weight
            amount = _round_amount(RNG.uniform(lo, hi))
            description = RNG.choice(descs)
            # occasional "no category" (dropped to 'other'-less)
            final_cat: str | None = None if RNG.random() < 0.05 else cat

            tx_tags: list[BudgetTag] = []
            if RNG.random() < 0.25 and tags:
                # 25% get 1-2 tags
                tx_tags = RNG.sample(tags, k=min(len(tags), RNG.choice([1, 1, 2])))

            db.add(Transaction(
                user_id=user.id, type="expense", amount=float(amount),
                category=final_cat, description=description, date=day_str,
                tags=tx_tags,
            ))
            created_count += 1

        # Salary on 10th and advance on 25th of each month
        if day.day == 10:
            desc, (lo, hi) = INCOME_PROFILES[0]
            db.add(Transaction(
                user_id=user.id, type="income",
                amount=float(_round_amount(RNG.uniform(lo, hi))),
                category=None, description=desc, date=day_str, tags=[],
            ))
            created_count += 1
        if day.day == 25:
            desc, (lo, hi) = INCOME_PROFILES[1]
            db.add(Transaction(
                user_id=user.id, type="income",
                amount=float(_round_amount(RNG.uniform(lo, hi))),
                category=None, description=desc, date=day_str, tags=[],
            ))
            created_count += 1

        # Small cashback every ~10 days
        if RNG.random() < 0.1:
            desc, (lo, hi) = INCOME_PROFILES[2]
            db.add(Transaction(
                user_id=user.id, type="income",
                amount=float(_round_amount(RNG.uniform(lo, hi))),
                category=None, description=desc, date=day_str, tags=[],
            ))
            created_count += 1

    return created_count


# ─── Tasks / boards / habits ─────────────────────────────────────────────────

BOARD_DATA: list[tuple[str, list[dict]]] = [
    ("Работа", [
        {"title": "Подготовить презентацию для заказчика", "priority": Priority.HIGH, "status": KanbanStatus.TODO, "deadline_offset": 4, "my_day": True},
        {"title": "Закрыть спринт 23", "priority": Priority.MEDIUM, "status": KanbanStatus.IN_PROGRESS, "deadline_offset": 2},
        {"title": "Ревью PR #142", "priority": Priority.LOW, "status": KanbanStatus.DONE, "completed_offset": 1},
        {"title": "Встреча с Анной по архитектуре", "priority": Priority.MEDIUM, "status": KanbanStatus.TODO, "scheduled_offset": 1, "scheduled_hour": 14},
    ]),
    ("Личное", [
        {"title": "Забрать посылку в пункте выдачи", "priority": Priority.URGENT, "status": KanbanStatus.TODO, "deadline_offset": 0, "my_day": True},
        {"title": "Записаться к стоматологу", "priority": Priority.MEDIUM, "status": KanbanStatus.TODO},
        {"title": "Починить велосипед", "priority": Priority.LOW, "status": KanbanStatus.DONE, "completed_offset": 5},
    ]),
    ("Хобби", [
        {"title": "Дочитать «Sapiens»", "priority": Priority.LOW, "status": KanbanStatus.IN_PROGRESS},
        {"title": "Свести демо-трек", "priority": Priority.MEDIUM, "status": KanbanStatus.TODO, "scheduled_offset": 3, "scheduled_hour": 20},
    ]),
]


def _utc_at(d: date, hour: int = 10) -> datetime:
    return datetime.combine(d, time(hour=hour, minute=0), tzinfo=timezone.utc)


async def seed_boards_and_tasks(db, user: User) -> int:
    today = date.today()
    existing_names = {
        r[0] for r in (
            await db.execute(select(Board.name).where(Board.user_id == user.id))
        ).all()
    }

    created_tasks = 0
    for board_name, tasks in BOARD_DATA:
        board = (
            await db.execute(
                select(Board).where(Board.user_id == user.id, Board.name == board_name)
            )
        ).scalar_one_or_none()
        if board is None:
            board = Board(user_id=user.id, name=board_name)
            db.add(board)
            await db.flush()
            await db.refresh(board)
        elif board_name not in existing_names:
            existing_names.add(board_name)

        for i, t in enumerate(tasks):
            scheduled_start = None
            scheduled_end = None
            if "scheduled_offset" in t:
                day = today + timedelta(days=int(t["scheduled_offset"]))
                scheduled_start = _utc_at(day, int(t.get("scheduled_hour", 10)))
                scheduled_end = scheduled_start + timedelta(hours=1)

            deadline = None
            if "deadline_offset" in t:
                deadline = _utc_at(today + timedelta(days=int(t["deadline_offset"])), 18)

            completed_at = None
            if t["status"] == KanbanStatus.DONE:
                off = int(t.get("completed_offset", 0))
                completed_at = _utc_at(today - timedelta(days=off))

            db.add(Task(
                user_id=user.id,
                board_id=board.id,
                title=t["title"],
                priority=t["priority"],
                status=t["status"],
                kanban_order=i,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                deadline=deadline,
                completed_at=completed_at,
                my_day=bool(t.get("my_day", False)),
            ))
            created_tasks += 1

    return created_tasks


HABIT_DATA: list[tuple[str, str, float]] = [
    ("Спорт", "#10B981", 0.7),       # ~70% completion
    ("Чтение", "#8B5CF6", 0.55),
    ("Медитация", "#06B6D4", 0.35),
]


async def seed_habits(db, user: User) -> int:
    today = date.today()
    existing = {
        r[0] for r in (await db.execute(select(Habit.name).where(Habit.user_id == user.id))).all()
    }
    created_logs = 0
    for name, color, completion in HABIT_DATA:
        if name in existing:
            continue
        habit = Habit(user_id=user.id, name=name, color=color, is_active=True)
        db.add(habit)
        await db.flush()
        await db.refresh(habit)

        for day_offset in range(21):
            day = today - timedelta(days=day_offset)
            if RNG.random() < completion:
                db.add(HabitLog(habit_id=habit.id, date=day))
                created_logs += 1
    return created_logs


# ─── Entrypoint ───────────────────────────────────────────────────────────────

def _parse_args(argv: Iterable[str]) -> int | None:
    args = list(argv)
    if "--user" in args:
        idx = args.index("--user")
        if idx + 1 >= len(args):
            raise SystemExit("--user requires an id")
        try:
            return int(args[idx + 1])
        except ValueError as exc:
            raise SystemExit(f"--user id must be int: {exc}") from None
    return None


async def main() -> None:
    user_id = _parse_args(sys.argv[1:])
    async with async_session() as db:
        user = await _pick_user(db, user_id)
        print(f"→ Seeding for user id={user.id} ({user.username})")

        tags = await seed_tags(db, user)
        print(f"  tags: {len(tags)} (now in DB)")

        await seed_allocations(db, user)
        await seed_planned(db, user)
        await seed_recurring(db, user)
        await db.flush()

        tx_count = await seed_transactions(db, user, tags)
        print(f"  transactions: +{tx_count}")

        task_count = await seed_boards_and_tasks(db, user)
        print(f"  tasks: +{task_count}")

        log_count = await seed_habits(db, user)
        print(f"  habit logs: +{log_count}")

        await db.commit()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
