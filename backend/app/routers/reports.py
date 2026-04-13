import json
import re
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.dependencies import get_current_user, get_db
from app.models.habit import Habit
from app.models.report import ReportStatus, WeeklyReport
from app.models.task import KanbanStatus, Task
from app.models.user import User
from app.schemas.report import WeeklyReportResponse
from app.services.gigachat import chat_completion, chat_completion_stream
from app.services.ntfy import send as ntfy_send
from app.services.weekly_report import build_weekly_data
from app.services.weekly_report_prompt import build_prompt

# Заголовок «Вступление», который GigaChat иногда добавляет вопреки инструкции
_INTRO_HEADING_RE = re.compile(r'^##\s*(?:Вступление|ВСТУПЛЕНИЕ)[^\n]*\n+', re.UNICODE)


def _strip_intro_heading(text: str) -> str:
    return _INTRO_HEADING_RE.sub('', text).lstrip('\n')


router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
    dependencies=[Depends(get_current_user)],
)


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("", response_model=list[WeeklyReportResponse])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Список недельных отчётов пользователя (новые сначала)."""
    result = await db.execute(
        select(WeeklyReport)
        .where(WeeklyReport.user_id == current_user.id)
        .order_by(WeeklyReport.week_start.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/generate", response_model=WeeklyReportResponse, status_code=202)
async def generate_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    week_start: date | None = Query(
        default=None,
        description="Понедельник недели (YYYY-MM-DD). По умолчанию — текущая неделя.",
    ),
):
    """
    Создаёт запись отчёта со статусом pending.
    Фактическая генерация происходит через GET /{id}/stream.
    """
    ws = week_start or _monday_of(date.today())

    result = await db.execute(
        select(WeeklyReport).where(
            WeeklyReport.user_id == current_user.id,
            WeeklyReport.week_start == ws,
        )
    )
    report = result.scalar_one_or_none()

    if report:
        # Сбрасываем в pending для перегенерации
        report.status = ReportStatus.PENDING
        report.content = None
        report.error_msg = None
    else:
        report = WeeklyReport(
            user_id=current_user.id,
            week_start=ws,
            status=ReportStatus.PENDING,
        )
        db.add(report)

    await db.commit()
    await db.refresh(report)
    return report


@router.post("/test-push")
async def test_push(current_user: User = Depends(get_current_user)):
    """Тестовый пуш — проверить что ntfy настроен и телефон получает уведомления."""
    from app.config import settings
    if not settings.ntfy_topic:
        return {"ok": False, "error": "NTFY_TOPIC не задан в .env"}
    ok = await ntfy_send(
        title="TimeScheduler работает",
        message="Пуш-уведомления настроены. Всё ок.",
        tags=["white_check_mark"],
        priority="default",
    )
    return {"ok": ok, "topic": settings.ntfy_topic, "server": settings.ntfy_server}


@router.get("/daily-tip")
async def get_daily_tip(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Генерирует короткое напутствие на день от лица питомца.
    Кешировать на стороне клиента — вызывать раз в день.
    """
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)

    base = (
        (Task.user_id == current_user.id)
        & (Task.deleted_at.is_(None))
        & (Task.status != KanbanStatus.DONE)
    )

    my_day_rows = (
        await db.execute(
            select(Task.title).where(base, Task.my_day.is_(True)).limit(8)
        )
    ).scalars().all()

    sched_rows = (
        await db.execute(
            select(Task.title).where(
                base,
                Task.my_day.is_(False),
                Task.scheduled_start >= today_start,
                Task.scheduled_start < today_end,
            ).limit(5)
        )
    ).scalars().all()

    habit_names = (
        await db.execute(
            select(Habit.name).where(
                Habit.user_id == current_user.id,
                Habit.is_active.is_(True),
            ).limit(6)
        )
    ).scalars().all()

    all_tasks = list(my_day_rows) + [t for t in sched_rows if t not in my_day_rows]

    prompt = _build_pet_prompt(all_tasks, list(habit_names))
    tip = await chat_completion([{"role": "user", "content": prompt}], max_tokens=180)

    return {"tip": tip.strip(), "date": str(today)}


def _build_pet_prompt(tasks: list[str], habits: list[str]) -> str:
    lines = [
        "Ты — маленький ASCII-кот, живущий в приложении продуктивности пользователя.",
        "Напиши короткое напутствие на сегодняшний день — ровно 2 предложения.",
        "Говори от своего лица, обращайся на «ты». Будь живым и немного ироничным.",
        "Упомяни 1-2 конкретные задачи из списка если они есть.",
        "Запрещено: «желаю успехов», «удачи», «конечно», «привет», смайлики, markdown.",
        "",
    ]
    if tasks:
        lines.append("Задачи на сегодня: " + ", ".join(f'«{t}»' for t in tasks))
    else:
        lines.append("Задач на сегодня нет.")
    if habits:
        lines.append("Привычки: " + ", ".join(habits))
    return "\n".join(lines)


@router.get("/{report_id}/stream")
async def stream_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE-эндпоинт стриминга отчёта.
    Генерирует текст в реальном времени и сохраняет результат в БД.

    События:
      data: {"t": "<chunk>"}   — очередной текстовый чанк
      data: {"done": true}     — генерация завершена
      data: {"error": "<msg>"} — ошибка
    """
    result = await db.execute(
        select(WeeklyReport).where(
            WeeklyReport.id == report_id,
            WeeklyReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    # Собираем данные в основной сессии (до открытия стрима)
    data = await build_weekly_data(db, current_user.id, report.week_start)
    prompt = build_prompt(data)

    async def event_stream():
        full_chunks: list[str] = []
        # Буфер для детектирования заголовка «Вступление» в начале ответа
        header_buf = ""
        header_checked = False

        try:
            async for chunk in chat_completion_stream([{"role": "user", "content": prompt}]):
                if not header_checked:
                    header_buf += chunk
                    # Ждём первый перенос строки или накопим 200 символов
                    if '\n' in header_buf or len(header_buf) >= 200:
                        header_checked = True
                        cleaned = _strip_intro_heading(header_buf)
                        if cleaned:
                            full_chunks.append(cleaned)
                            yield f"data: {json.dumps({'t': cleaned}, ensure_ascii=False)}\n\n"
                    # Пока буферизируем — не отправляем клиенту
                else:
                    full_chunks.append(chunk)
                    yield f"data: {json.dumps({'t': chunk}, ensure_ascii=False)}\n\n"

            # Если поток закончился, а заголовок так и не был проверен (очень короткий ответ)
            if not header_checked and header_buf:
                cleaned = _strip_intro_heading(header_buf)
                if cleaned:
                    full_chunks.append(cleaned)
                    yield f"data: {json.dumps({'t': cleaned}, ensure_ascii=False)}\n\n"

        except Exception as exc:
            err_msg = str(exc)[:500]
            yield f"data: {json.dumps({'error': err_msg}, ensure_ascii=False)}\n\n"
            async with async_session() as sess:
                r = await sess.get(WeeklyReport, report_id)
                if r:
                    r.status = ReportStatus.ERROR
                    r.error_msg = err_msg
                    await sess.commit()
            return

        full_text = "".join(full_chunks)
        async with async_session() as sess:
            r = await sess.get(WeeklyReport, report_id)
            if r:
                r.status = ReportStatus.DONE
                r.content = full_text
                r.error_msg = None
                await sess.commit()

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # отключает буферизацию в nginx
        },
    )
