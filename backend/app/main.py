import asyncio
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import admin, auth, backup, boards, budget, export, habits, notes, stats, tags, tasks, telegram
from app.services.backup import run_backup
from app.services.telegram_bot import poll_telegram_updates, send_telegram_reminders

scheduler = AsyncIOScheduler()


def _run_migrations() -> None:
    from alembic import command
    from alembic.config import Config
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Run migrations in thread (alembic uses asyncio.run, conflicts with uvicorn loop)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _run_migrations)

    # Ensure admin user exists (create if missing)
    from sqlalchemy import select, text
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.database import async_session
    from app.models.user import User
    from app.services.auth import hash_password, verify_password_hash

    async with async_session() as session:
        if settings.clean_db_on_startup:
            await session.execute(
                text("TRUNCATE tasks, habits, tags, users RESTART IDENTITY CASCADE")
            )
            await session.commit()

        result = await session.execute(select(User).where(User.username == settings.user_login))
        admin = result.scalar_one_or_none()
        if admin is None:
            admin = User(
                username=settings.user_login,
                password_hash=hash_password(settings.user_password),
                is_admin=True,
            )
            session.add(admin)
            await session.commit()
            await session.refresh(admin)
        elif not verify_password_hash(settings.user_password, admin.password_hash):
            admin.password_hash = hash_password(settings.user_password)
            admin.is_admin = True
            await session.commit()

    # Schedule periodic backup
    scheduler.add_job(
        run_backup,
        "interval",
        hours=settings.backup_interval_hours,
        id="db_backup",
        replace_existing=True,
    )

    # Telegram: poll updates from bot every 5 seconds
    scheduler.add_job(
        poll_telegram_updates,
        "interval",
        seconds=5,
        id="tg_polling",
        replace_existing=True,
    )

    # Telegram: send pending reminders every minute
    scheduler.add_job(
        send_telegram_reminders,
        "interval",
        minutes=1,
        id="tg_reminders",
        replace_existing=True,
    )

    scheduler.start()

    yield

    scheduler.shutdown()
    await engine.dispose()


app = FastAPI(title="TimeScheduler", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(tasks.router)
app.include_router(boards.router)
app.include_router(tags.router)
app.include_router(habits.router)
app.include_router(stats.router)
app.include_router(export.router)
app.include_router(backup.router)
app.include_router(telegram.router)
app.include_router(notes.router)
app.include_router(budget.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
