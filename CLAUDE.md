# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeScheduler is a personal task/habit scheduling app with a FastAPI backend and React frontend. It is a single-user application (though multi-user with admin/regular roles is supported at the model level).

## Architecture

### Backend (`backend/`)
- **FastAPI** application with async SQLAlchemy + PostgreSQL (`asyncpg`)
- **Alembic** for migrations (auto-run on startup via `alembic upgrade head`)
- **APScheduler** runs background jobs: periodic DB backup, Telegram long-polling (every 30s), Telegram reminders (every 1m), weekly AI report (Sunday 21:00 in `settings.user_timezone`)
- On startup, the app creates the admin user from `settings.user_login` / `settings.user_password` if missing, or updates the password hash if it changed
- All routes are prefixed with `/api` and use JWT Bearer auth. `get_current_user` and `get_admin_user` are the dependency functions in `backend/app/dependencies.py`
- Config is loaded from `.env` (at repo root, one level above `backend/`) via `pydantic-settings`

**Key models:**
- `Task` — main entity with priority, kanban status/order, schedule, deadline, repeat days, board reference, tags (M2M), Telegram reminder fields, archive flag, subtasks (self-FK with `delete-orphan` cascade)
- `Habit` + `HabitLog` — habit tracking with daily logs
- `Board` — kanban boards; tasks belong to a board via `board_id` (`SET NULL` on delete)
- `Tag` — per-user tags with color, linked to tasks via `task_tags` junction
- `User` — auth; `telegram_chat_id` stored here after Telegram linkage
- `TelegramKey` — one-time keys for linking user accounts to Telegram
- `TelegramState` — one-row table holding the long-poll `last_update_id`
- `Transaction`, `PlannedPurchase`, `BudgetTag`, `BudgetAllocation` — backend-persisted budget data
- `WeeklyReport` — generated AI weekly summaries (status: pending/in_progress/done/error)

**Router structure:** `auth`, `admin`, `tasks`, `boards`, `tags`, `habits`, `stats`, `export`, `backup`, `telegram`, `budget`, `search`, `reports`. (The `reports` router's `GET /reports/daily-tip` endpoint was removed; it no longer exists.)

**LLM integration:** `backend/app/services/gigachat.py` (legacy name) is a provider-agnostic OpenAI-compatible client. `LLM_PROVIDER` selects between `gigachat` (cloud.ru foundation-models, `GIGACHAT_API_KEY`) and `nvidia` (NVIDIA NIM `integrate.api.nvidia.com`, `NVIDIA_API_KEY`). Both expose `/v1/chat/completions`, so only `base_url`/`api_key`/model name differ. All errors are mapped to `RuntimeError` with human-readable messages — call sites translate them to HTTP 503.

### Frontend (`frontend/`)
- **React 18** + **TypeScript** + **Vite**
- **TanStack Query** for server state; queries live in `src/hooks/`
- **Axios** client at `src/api/client.ts` with JWT interceptor; proxies `/api` to `localhost:8000` in dev
- Path alias `@` maps to `src/`
- **Tailwind CSS** for styling
- **dnd-kit** for drag-and-drop (kanban)
- **recharts** for stats visualizations (used by `StatsPeriodView.tsx` and `HabitsPage.tsx`)
- **framer-motion** for animations
- Two themes (`dark` default, `light`), defined in `src/styles/tokens.ts` and switched via `ThemeContext`

**Pages:** Today, Calendar (day/week/month views), Boards, Kanban (per-board), Habits, Stats, Export, Notifications, Admin. (Notes were dropped in migration `012_drop_notes_table.py` and removed from the UI. Budget has no frontend page — the API and all 8 Prisma budget models remain, unconsumed by the UI.)

**Auth flow:** JWT stored in `localStorage`. On 401 response, the axios interceptor (`src/api/client.ts`) shows a toast and redirects to `/login` after a short delay. `AuthContext` provides `isAuthenticated` and `isAdmin`.

**localStorage-only state:** Theme preference (`ThemeContext`) and last-seen-reports timestamp (`useReports`).

## Development Commands

### Backend
```bash
cd backend
pip install -e ".[dev]"          # install with dev extras
uvicorn app.main:app --reload    # run dev server on :8000
alembic upgrade head             # apply migrations manually
alembic revision --autogenerate -m "description"  # create migration
pytest                           # run tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # dev server on :5173 (proxies /api to :8000)
npm run build    # tsc + vite build
```

## Configuration

Environment variables (`.env` at repo root, read by `backend/app/config.py`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://ts_user:password@localhost:5432/timescheduler` | Async DB URL |
| `SECRET_KEY` | `change-me-in-production` | JWT signing key |
| `USER_LOGIN` | `Wor7hless` | Admin username |
| `USER_PASSWORD` | `change-me` | Admin password |
| `TELEGRAM_BOT_TOKEN` | `` | Optional; enables Telegram reminders |
| `CLEAN_DB_ON_STARTUP` | `false` | ⚠️ Truncates ALL tables on next startup (one-time reset). Includes a 3-sec warning delay in logs. |
| `BACKUP_INTERVAL_HOURS` | `24` | DB backup frequency |
| `BACKUP_DIR` | `./backups` | Backup storage path |
| `USER_TIMEZONE` | `Europe/Moscow` | Timezone for weekly-report cron and Telegram reminder display |
| `LLM_PROVIDER` | `gigachat` | `gigachat` or `nvidia` — picks which OpenAI-compatible backend is used. |
| `GIGACHAT_API_KEY` | `` | API key for cloud.ru GigaChat (used when `LLM_PROVIDER=gigachat`). Empty disables LLM features. |
| `NVIDIA_API_KEY` | `` | API key for NVIDIA NIM (used when `LLM_PROVIDER=nvidia`). |
| `NTFY_TOPIC` | `` | ntfy.sh topic for mobile push notifications (empty disables) |
| `NTFY_SERVER` | `https://ntfy.sh` | ntfy server URL |

## Key Conventions

- All DB timestamps are stored as UTC. The Telegram reminder service converts to `settings.user_timezone` for display.
- `repeat_days` on `Task` is a PostgreSQL `ARRAY(Integer)` where 0=Monday, 6=Sunday.
- New Alembic migrations go in `backend/alembic/versions/` and are numbered sequentially (`001_`, `002_`, etc.). The filename prefix must match the `revision = '...'` inside the file.
- The backend runs migrations automatically at startup — no separate migration step needed in production.
- `CLEAN_DB_ON_STARTUP=true` uses a raw `TRUNCATE ... CASCADE` over every table from `Base.metadata.sorted_tables`, logs a warning and sleeps 3 sec before executing. Should only be set once for a reset, then removed.
- Report status uses the `ReportStatus` enum: `pending` → `in_progress` → `done`/`error`. `/api/reports/{id}/stream` atomically transitions to `in_progress` on entry; a parallel call gets 409.
- Telegram long-poll `last_update_id` lives in the one-row `telegram_state` table (not in a Python global). Polling is scheduled every 30s with `max_instances=1` to prevent overlap.
