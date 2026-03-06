# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeScheduler is a personal task/habit scheduling app with a FastAPI backend and React frontend. It is a single-user application (though multi-user with admin/regular roles is supported at the model level).

## Architecture

### Backend (`backend/`)
- **FastAPI** application with async SQLAlchemy + PostgreSQL (`asyncpg`)
- **Alembic** for migrations (auto-run on startup via `alembic upgrade head`)
- **APScheduler** runs background jobs: periodic DB backup, Telegram polling (every 5s), Telegram reminders (every 1m)
- On startup, the app creates the admin user from `settings.user_login` / `settings.user_password` if missing, or updates the password hash if it changed
- All routes are prefixed with `/api` and use JWT Bearer auth. `get_current_user` and `get_admin_user` are the dependency functions in `backend/app/dependencies.py`
- Config is loaded from `.env` (at repo root, one level above `backend/`) via `pydantic-settings`

**Key models:**
- `Task` — main entity with priority, kanban status/order, schedule, deadline, repeat days, board reference, tags (M2M), Telegram reminder fields, archive flag
- `Habit` + `HabitLog` — habit tracking with daily logs
- `Board` — kanban boards; tasks belong to a board via `board_id`
- `Tag` — per-user tags with color, linked to tasks via `task_tags` junction
- `User` — auth; `telegram_chat_id` stored here after Telegram linkage
- `TelegramKey` — one-time keys for linking user accounts to Telegram

**Router structure:** `auth`, `admin`, `tasks`, `boards`, `tags`, `habits`, `stats`, `export`, `backup`, `telegram`

### Frontend (`frontend/`)
- **React 18** + **TypeScript** + **Vite**
- **TanStack Query** for server state; queries live in `src/hooks/`
- **Axios** client at `src/api/client.ts` with JWT interceptor; proxies `/api` to `localhost:8000` in dev
- Path alias `@` maps to `src/`
- **Tailwind CSS** for styling
- **dnd-kit** for drag-and-drop (kanban)
- **recharts** + **react-activity-calendar** for stats visualizations
- **framer-motion** for animations

**Pages:** Today, Calendar (day/week/month views), Boards, Kanban (per-board), Habits, Stats, Notes, Budget, Export, Admin

**Auth flow:** JWT stored in `localStorage`. On 401 response, the axios interceptor clears the token and redirects to `/login`. `AuthContext` provides `isAuthenticated` and `isAdmin`.

**localStorage-only features (no backend sync):** Notes (`notes` key) and Budget (`budget_data` key) are stored entirely in `localStorage`. They are per-browser and do not sync across devices or users. If backend persistence is needed for these features, it must be built from scratch.

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
| `CLEAN_DB_ON_STARTUP` | `false` | Truncates all data on next startup (one-time reset) |
| `BACKUP_INTERVAL_HOURS` | `24` | DB backup frequency |
| `BACKUP_DIR` | `./backups` | Backup storage path |

## Key Conventions

- All DB timestamps are stored as UTC. The Telegram reminder service hardcodes UTC+3 (Moscow) for display — this is intentional.
- `repeat_days` on `Task` is a PostgreSQL `ARRAY(Integer)` where 0=Monday, 6=Sunday.
- New Alembic migrations go in `backend/alembic/versions/` and are numbered sequentially (`001_`, `002_`, etc.).
- The backend runs migrations automatically at startup — no separate migration step needed in production.
- `CLEAN_DB_ON_STARTUP=true` uses a raw `TRUNCATE` SQL statement and should only be set once for a reset, then removed.
