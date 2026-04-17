import asyncio
import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.dependencies import get_current_user, get_db
from app.models.habit import Habit
from app.models.report import ReportStatus, WeeklyReport
from app.models.task import KanbanStatus, Task
from app.models.user import User
from app.schemas.report import WeeklyReportResponse
from app.services.gigachat import chat_completion, chat_completion_stream
from app.services.ntfy import send as ntfy_send
from app.services.weekly_report import _strip_intro_heading, build_weekly_data
from prompts.pet_tip import build_pet_prompt
from prompts.weekly_report import build_prompt


router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
    dependencies=[Depends(get_current_user)],
)

# Если отчёт в in_progress дольше этого времени — считаем стрим мёртвым
# (например, клиент отвалился, сеть упала) и разрешаем перегенерацию.
STALE_IN_PROGRESS = timedelta(minutes=10)


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _is_stale_in_progress(report: WeeklyReport) -> bool:
    if report.status != ReportStatus.IN_PROGRESS.value:
        return False
    updated = report.updated_at
    if updated is None:
        return True
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - updated > STALE_IN_PROGRESS


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


@router.post("/request-summary", response_model=WeeklyReportResponse)
async def request_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Self-service запрос отчёта на текущую неделю.
    Доступно, если is_admin или can_request_summary. Без лимитов — каждый клик
    создаёт/пересбрасывает отчёт, чтобы его можно было перегенерировать.
    Если прямо сейчас идёт стриминг (in_progress) — возвращаем его, чтобы
    параллельный запрос не перехватывал сессию.
    """
    if not (current_user.is_admin or current_user.can_request_summary):
        raise HTTPException(
            status_code=403,
            detail="Нет права запрашивать саммари. Обратитесь к администратору.",
        )

    if not settings.gigachat_api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM отключён в конфигурации (GIGACHAT_API_KEY не задан).",
        )

    ws = _monday_of(date.today())

    result = await db.execute(
        select(WeeklyReport).where(
            WeeklyReport.user_id == current_user.id,
            WeeklyReport.week_start == ws,
        )
    )
    report = result.scalar_one_or_none()

    if report is None:
        report = WeeklyReport(
            user_id=current_user.id,
            week_start=ws,
            status=ReportStatus.PENDING,
        )
        db.add(report)
    elif report.status == ReportStatus.IN_PROGRESS.value and not _is_stale_in_progress(report):
        # Уже пишется в другой вкладке — не мешаем.
        return report
    else:
        # done / pending / error — сбрасываем в pending, фронт сразу стартует стрим.
        report.status = ReportStatus.PENDING
        report.content = None
        report.error_msg = None

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
    if not settings.gigachat_api_key:
        return {"tip": None, "date": str(date.today()), "disabled": True}

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
            select(Task.title).where(base, Task.my_day.is_(True)).limit(6)
        )
    ).scalars().all()

    sched_rows = (
        await db.execute(
            select(Task.title).where(
                base,
                Task.my_day.is_(False),
                Task.scheduled_start >= today_start,
                Task.scheduled_start < today_end,
            ).limit(4)
        )
    ).scalars().all()

    deadline_today_rows = (
        await db.execute(
            select(Task.title).where(
                base,
                Task.my_day.is_(False),
                Task.deadline >= today_start,
                Task.deadline < today_end,
                Task.scheduled_start.is_(None),
            ).limit(5)
        )
    ).scalars().all()

    overdue_rows = (
        await db.execute(
            select(Task.title).where(
                base,
                Task.deadline < today_start,
            ).limit(3)
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

    prompt = build_pet_prompt(
        all_tasks,
        list(habit_names),
        list(deadline_today_rows),
        list(overdue_rows),
    )
    try:
        tip = await chat_completion([{"role": "user", "content": prompt}], max_tokens=200)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {"tip": tip.strip(), "date": str(today)}



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

    if report.status == ReportStatus.IN_PROGRESS.value and not _is_stale_in_progress(report):
        raise HTTPException(
            status_code=409,
            detail="Отчёт уже генерируется в другой вкладке.",
        )

    # Атомарно переводим в IN_PROGRESS, чтобы параллельный запрос получил 409
    report.status = ReportStatus.IN_PROGRESS.value
    report.error_msg = None
    await db.commit()
    await db.refresh(report)

    week_start = report.week_start
    user_id = current_user.id

    async def _finalize(status: ReportStatus, content: str | None, err: str | None) -> None:
        """Гарантированно пишет финальное состояние отчёта в БД.
        Вызывается из finally — не должен сам кидать наружу."""
        try:
            async with async_session() as sess:
                r = await sess.get(WeeklyReport, report_id)
                if not r:
                    return
                r.status = status.value
                if content is not None:
                    r.content = content
                r.error_msg = err
                await sess.commit()
        except Exception:
            logger = __import__("logging").getLogger(__name__)
            logger.exception("Failed to finalize report %s", report_id)

    async def event_stream():
        full_chunks: list[str] = []
        header_buf = ""
        header_checked = False
        final_status: ReportStatus = ReportStatus.ERROR
        final_error: str | None = "Прервано"

        # Первый байт сразу — чтобы nginx не закрыл idle-соединение,
        # а клиент увидел, что стрим пошёл.
        yield ": open\n\n"

        try:
            # Собираем данные внутри стрима — не блокируем TTFB.
            async with async_session() as data_sess:
                data = await build_weekly_data(data_sess, user_id, week_start)
            prompt = build_prompt(data)

            # Heartbeat: пока LLM ещё не прислал первый токен, шлём комменты
            # каждые 10 сек, чтобы прокси не закрыл соединение.
            stream_gen = chat_completion_stream([{"role": "user", "content": prompt}])
            got_first = False

            while True:
                try:
                    chunk = await asyncio.wait_for(stream_gen.__anext__(), timeout=10.0)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                except StopAsyncIteration:
                    break

                got_first = True
                if not header_checked:
                    header_buf += chunk
                    if '\n' in header_buf or len(header_buf) >= 200:
                        header_checked = True
                        cleaned = _strip_intro_heading(header_buf)
                        if cleaned:
                            full_chunks.append(cleaned)
                            yield f"data: {json.dumps({'t': cleaned}, ensure_ascii=False)}\n\n"
                else:
                    full_chunks.append(chunk)
                    yield f"data: {json.dumps({'t': chunk}, ensure_ascii=False)}\n\n"

            if not header_checked and header_buf:
                cleaned = _strip_intro_heading(header_buf)
                if cleaned:
                    full_chunks.append(cleaned)
                    yield f"data: {json.dumps({'t': cleaned}, ensure_ascii=False)}\n\n"

            if not got_first and not full_chunks:
                raise RuntimeError("LLM вернул пустой ответ.")

            final_status = ReportStatus.DONE
            final_error = None
            yield f"data: {json.dumps({'done': True})}\n\n"

        except asyncio.CancelledError:
            # Клиент отвалился. Помечаем ERROR, но исключение пробрасываем.
            final_status = ReportStatus.ERROR
            final_error = "Клиент отключился во время генерации"
            raise
        except Exception as exc:
            err_msg = str(exc)[:500] or "Неизвестная ошибка"
            final_status = ReportStatus.ERROR
            final_error = err_msg
            try:
                yield f"data: {json.dumps({'error': err_msg}, ensure_ascii=False)}\n\n"
            except Exception:
                pass
        finally:
            content = "".join(full_chunks) if final_status == ReportStatus.DONE else None
            await _finalize(final_status, content, final_error)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # отключает буферизацию в nginx
            "Connection": "keep-alive",
        },
    )
