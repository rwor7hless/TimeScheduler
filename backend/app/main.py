import asyncio
import logging
from contextlib import asynccontextmanager

# INFO-уровень на root-логгере — иначе logger.info() из наших модулей
# (app.services.gigachat, app.routers.reports, ...) режется дефолтным WARNING.
# force=True перезаписывает хендлеры, которые мог поставить uvicorn / библиотеки.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    force=True,
)

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings

if settings.secret_key == "change-me-in-production":
    logging.warning(
        "SECRET_KEY is set to the default insecure value! "
        "Set SECRET_KEY in your .env file before deploying to production."
    )
from app.database import Base, engine
from app.routers import admin, auth, backup, boards, budget, export, habits, reports, search, stats, tags, tasks, telegram
from app.services.backup import run_backup
from app.services.budget_alerts import check_budget_alerts
from app.services.budget_recurring import generate_recurring_transactions
from app.services.gigachat import llm_available, llm_info, llm_unavailable_reason
from app.services.telegram_bot import poll_telegram_updates, send_telegram_reminders
from app.services.weekly_report import run_weekly_reports

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
            logging.warning(
                "⚠️  CLEAN_DB_ON_STARTUP=True: ВСЕ ДАННЫЕ БУДУТ УДАЛЕНЫ через 3 сек. "
                "Ctrl+C если это не то, что вы хотели."
            )
            await asyncio.sleep(3)
            table_names = ", ".join(t.name for t in Base.metadata.sorted_tables)
            await session.execute(
                text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE")
            )
            await session.commit()
            logging.warning("CLEAN_DB_ON_STARTUP: все таблицы очищены, sequence сброшены")

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

        # Сбрасываем зависшие in_progress отчёты после рестарта —
        # их стрим оборвался вместе с процессом.
        from app.models.report import ReportStatus, WeeklyReport
        stuck = await session.execute(
            select(WeeklyReport).where(WeeklyReport.status == ReportStatus.IN_PROGRESS.value)
        )
        for r in stuck.scalars().all():
            r.status = ReportStatus.ERROR.value
            r.error_msg = "Генерация прервана рестартом сервера"
        await session.commit()

    # Schedule periodic backup
    scheduler.add_job(
        run_backup,
        "interval",
        hours=settings.backup_interval_hours,
        id="db_backup",
        replace_existing=True,
    )

    # Telegram: long-poll каждые 30 сек (long-poll внутри ждёт до 25с,
    # не запускаем чаще чем раз в 30с чтобы запросы не наслаивались)
    scheduler.add_job(
        poll_telegram_updates,
        "interval",
        seconds=30,
        id="tg_polling",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Telegram: send pending reminders every minute
    scheduler.add_job(
        send_telegram_reminders,
        "interval",
        minutes=1,
        id="tg_reminders",
        replace_existing=True,
    )

    # Budget: generate recurring transactions daily at 00:15 in user_timezone
    scheduler.add_job(
        generate_recurring_transactions,
        "cron",
        hour=0,
        minute=15,
        timezone=settings.user_timezone,
        id="budget_recurring",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Budget alerts — twice a day (10:00 and 20:00 local). Dedupes via budget_alert_log.
    scheduler.add_job(
        check_budget_alerts,
        "cron",
        hour="10,20",
        minute=0,
        timezone=settings.user_timezone,
        id="budget_alerts",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Weekly AI report: every Sunday at 21:00 user_timezone (только если LLM сконфигурирован)
    if llm_available():
        info = llm_info()
        logging.info(
            "LLM enabled: provider=%s model=%s", info["provider"], info["model"]
        )
        scheduler.add_job(
            run_weekly_reports,
            "cron",
            day_of_week="sun",
            hour=21,
            minute=0,
            timezone=settings.user_timezone,
            id="weekly_reports",
            replace_existing=True,
        )
    else:
        logging.warning(
            "Weekly reports cron disabled: %s", llm_unavailable_reason()
        )

    scheduler.start()

    yield

    scheduler.shutdown()
    await engine.dispose()


limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="TimeScheduler", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )


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
app.include_router(budget.router)
app.include_router(search.router)
app.include_router(reports.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
