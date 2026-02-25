"""
Seed test data for the admin user.
Run inside docker: docker compose exec backend python seed_test_data.py
"""
import asyncio
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.habit import Habit
from app.models.habit_log import HabitLog
from app.models.task import TASK_COLOR_PALETTE, KanbanStatus, Priority, Tag, Task
from app.models.user import User


async def seed():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == settings.user_login))
        admin = result.scalar_one_or_none()
        if not admin:
            print("Admin user not found!")
            return

        uid = admin.id
        now = datetime.now(timezone.utc)
        today = date.today()

        # --- Tags ---
        tag_names = [
            ("Работа", "#3B82F6"),
            ("Личное", "#10B981"),
            ("Учёба", "#8B5CF6"),
            ("Спорт", "#F97316"),
        ]
        tags: list[Tag] = []
        for name, color in tag_names:
            existing = await db.execute(
                select(Tag).where(Tag.user_id == uid, Tag.name == name)
            )
            tag = existing.scalar_one_or_none()
            if not tag:
                tag = Tag(user_id=uid, name=name, color=color)
                db.add(tag)
                await db.flush()
            tags.append(tag)

        # --- Tasks (mix of completed, active, scheduled) ---
        task_templates = [
            "Подготовить презентацию",
            "Ревью кода",
            "Написать документацию",
            "Исправить баг в авторизации",
            "Дизайн нового экрана",
            "Настроить CI/CD",
            "Встреча с командой",
            "Тестирование API",
            "Рефакторинг модуля",
            "Обновить зависимости",
            "Код-ревью PR #42",
            "Написать тесты",
            "Планирование спринта",
            "Деплой на прод",
            "Анализ метрик",
            "Оптимизация запросов",
            "Миграция базы данных",
            "Прототип новой фичи",
            "Исправить стили мобилки",
            "Созвон с заказчиком",
        ]

        priorities = list(Priority)
        statuses_pool = [
            KanbanStatus.DONE, KanbanStatus.DONE, KanbanStatus.DONE,
            KanbanStatus.TODO, KanbanStatus.IN_PROGRESS,
        ]

        for i, title in enumerate(task_templates):
            status = statuses_pool[i % len(statuses_pool)]
            days_ago = random.randint(0, 29)
            created = now - timedelta(days=days_ago, hours=random.randint(1, 12))
            completed_at = None

            if status == KanbanStatus.DONE:
                completed_at = created + timedelta(
                    hours=random.randint(1, 48),
                    minutes=random.randint(0, 59),
                )
                if completed_at > now:
                    completed_at = now - timedelta(minutes=random.randint(10, 300))

            has_schedule = random.random() < 0.6
            scheduled_start = None
            scheduled_end = None
            if has_schedule:
                sched_date = today - timedelta(days=days_ago)
                hour = random.randint(8, 20)
                scheduled_start = datetime(
                    sched_date.year, sched_date.month, sched_date.day,
                    hour, 0, tzinfo=timezone.utc
                )
                scheduled_end = scheduled_start + timedelta(hours=random.choice([1, 2]))

            task = Task(
                user_id=uid,
                title=title,
                description=f"Описание для задачи: {title}" if random.random() < 0.4 else None,
                color=random.choice(TASK_COLOR_PALETTE),
                priority=random.choice(priorities),
                status=status,
                kanban_order=i,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                completed_at=completed_at,
                created_at=created,
            )
            task.tags = random.sample(tags, k=random.randint(0, 2))
            db.add(task)

        # --- Habits ---
        habit_defs = [
            ("Утренняя зарядка", "#F59E0B"),
            ("Чтение 30 минут", "#3B82F6"),
            ("Медитация", "#8B5CF6"),
        ]
        for name, color in habit_defs:
            existing = await db.execute(
                select(Habit).where(Habit.user_id == uid, Habit.name == name)
            )
            if existing.scalar_one_or_none():
                continue

            habit = Habit(
                user_id=uid,
                name=name,
                color=color,
                is_active=True,
                created_at=now - timedelta(days=60),
            )
            db.add(habit)
            await db.flush()

            for days_back in range(59, -1, -1):
                if random.random() < 0.65:
                    log_date = today - timedelta(days=days_back)
                    hour = random.choice([7, 8, 9, 18, 19, 20, 21, 22])
                    completed_at = datetime(
                        log_date.year, log_date.month, log_date.day,
                        hour, random.randint(0, 59), tzinfo=timezone.utc,
                    )
                    db.add(HabitLog(
                        habit_id=habit.id,
                        date=log_date,
                        completed_at=completed_at,
                    ))

        await db.commit()
        print("Seed data created successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
