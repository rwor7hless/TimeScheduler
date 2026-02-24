# TimeScheduler

Personal productivity app with a calendar, Kanban boards, habit tracker, and statistics. Self-hosted, single-user, runs fully in Docker.

---

## Features

| Module | What it does |
|---|---|
| **Calendar** | Day / Week / Month views. Click a slot to create a task at that time. Tasks scale to their duration. |
| **Kanban** | Multiple named boards. Drag-and-drop between columns (To Do → In Progress → Done). Per-column task creation. |
| **Habits** | Track daily habits. GitHub-style year heatmap, 30-day bar chart, time-of-day distribution, streak counters. |
| **Statistics** | Completion rates, priority breakdown, productivity charts across all tasks and habits. |
| **Export** | Download tasks or habits as JSON or CSV for a selected date range. |
| **Backups** | Automatic scheduled `pg_dump` saved to `./backups/`. Configurable interval. |
| **Admin** | User management panel (admin-only route). |

---

## Tech stack

**Backend**
- Python 3.11 · FastAPI · Uvicorn
- SQLAlchemy 2.0 (async) · asyncpg · PostgreSQL 16
- Alembic (auto-migrations on startup)
- PyJWT + pwdlib[argon2] (authentication)
- APScheduler (background backup job)
- Pydantic Settings

**Frontend**
- React 18 · TypeScript · Vite
- TailwindCSS · Inter font
- TanStack Query v5 (server state)
- @dnd-kit (drag-and-drop)
- recharts (charts)
- date-fns · react-hot-toast · framer-motion

**Infrastructure**
- Docker Compose (3 services: `db`, `backend`, `frontend`)
- nginx (SPA + reverse proxy to API on `/api`)

---

## Quick start

### Prerequisites
- Docker and Docker Compose

### 1. Clone and configure

```bash
git clone https://github.com/yourname/TimeScheduler.git
cd TimeScheduler
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql+asyncpg://ts_user:ts_secure_pass_2026@localhost:5432/timescheduler
SECRET_KEY=<run: openssl rand -hex 32>
USER_LOGIN=Wor7hless
USER_PASSWORD=your_secure_password
BACKUP_INTERVAL_HOURS=24
BACKUP_DIR=./backups
CLEAN_DB_ON_STARTUP=false
CORS_ORIGINS=["http://localhost:3000"]
```

> **Important:** `SECRET_KEY` must be a random 32-byte hex string. Generate with `openssl rand -hex 32`.

### 2. Run

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

### 3. Login

Use the credentials from `USER_LOGIN` / `USER_PASSWORD` in your `.env`.

---

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL async connection string | — |
| `SECRET_KEY` | JWT signing secret (generate randomly) | — |
| `USER_LOGIN` | Primary user's login name | `Wor7hless` |
| `USER_PASSWORD` | Primary user's password | — |
| `BACKUP_INTERVAL_HOURS` | Hours between automatic pg_dump backups | `24` |
| `BACKUP_DIR` | Directory to save backups (mounted as volume) | `./backups` |
| `CLEAN_DB_ON_STARTUP` | Truncate all data and recreate admin on next start | `false` |
| `CORS_ORIGINS` | JSON array of allowed frontend origins | `["http://localhost:3000"]` |

---

## Project structure

```
TimeScheduler/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, CORS, routers
│   │   ├── config.py            # Pydantic Settings
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── dependencies.py      # get_db, get_current_user
│   │   ├── models/
│   │   │   ├── task.py          # Task, Tag, task_tags M2M
│   │   │   ├── board.py         # Board (Kanban board)
│   │   │   ├── habit.py         # Habit
│   │   │   ├── habit_log.py     # HabitLog (unique per habit+date)
│   │   │   └── user.py          # User
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── auth.py          # POST /api/auth/login, /refresh, /me
│   │   │   ├── tasks.py         # CRUD + PATCH /reorder (before /{id}!)
│   │   │   ├── boards.py        # CRUD for Kanban boards
│   │   │   ├── tags.py          # CRUD for tags
│   │   │   ├── habits.py        # CRUD + POST /{id}/log (toggle)
│   │   │   ├── stats.py         # GET /api/stats
│   │   │   ├── export.py        # GET /api/export/{format}
│   │   │   ├── backup.py        # POST /api/backup/run
│   │   │   └── admin.py         # Admin-only user management
│   │   └── services/
│   │       ├── auth.py          # hash_password, verify_password, JWT
│   │       ├── stats.py         # Stats aggregation logic
│   │       └── backup.py        # pg_dump subprocess
│   ├── alembic/                 # DB migrations
│   ├── Dockerfile
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── api/                 # axios wrappers (tasks, habits, stats, …)
│   │   ├── components/
│   │   │   ├── calendar/        # DayView, WeekView, MonthView
│   │   │   ├── kanban/          # KanbanPage drag-and-drop components
│   │   │   ├── tasks/           # TaskCard, TaskModal
│   │   │   ├── layout/          # AppShell, Sidebar, Header
│   │   │   └── ui/              # Button, Input, Modal, Select, Spinner, …
│   │   ├── context/             # AuthContext (JWT, user state)
│   │   ├── hooks/               # useTasks, useHabits, useStats, …
│   │   ├── pages/               # CalendarPage, KanbanPage, HabitsPage, …
│   │   ├── types/               # TypeScript interfaces
│   │   └── styles/globals.css   # CSS variables, scrollbar, Inter font
│   ├── Dockerfile               # Build + nginx serve
│   ├── nginx.conf               # SPA fallback + /api proxy
│   └── vite.config.ts
│
├── docker-compose.yml
├── .env.example
└── backups/                     # pg_dump files (auto-created)
```

---

## API overview

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Get JWT token |
| `GET` | `/auth/me` | Current user info |
| `GET/POST` | `/tasks` | List / create tasks |
| `GET/PUT/PATCH/DELETE` | `/tasks/{id}` | Single task operations |
| `PATCH` | `/tasks/reorder` | Kanban drag reorder |
| `GET/POST/DELETE` | `/boards` | Kanban boards |
| `GET/POST/DELETE` | `/tags` | Tags |
| `GET/POST/PUT/DELETE` | `/habits` | Habits |
| `POST` | `/habits/{id}/log` | Toggle today's habit log |
| `GET` | `/habits/{id}/logs` | Habit log history |
| `GET` | `/stats` | Aggregated statistics |
| `GET` | `/export/{format}` | Export data (json/csv) |
| `POST` | `/backup/run` | Trigger manual backup |
| `GET` | `/health` | Health check |

Interactive docs: **http://localhost:8000/docs**

---

## Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -e ".[dev]"

# Start PostgreSQL separately (e.g. via Docker):
docker run -d -p 5432:5432 -e POSTGRES_DB=timescheduler -e POSTGRES_USER=ts_user -e POSTGRES_PASSWORD=ts_secure_pass_2026 postgres:16-alpine

# Set env vars, then:
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8000` (see `vite.config.ts`).

---

## Backups

Automatic backups run every `BACKUP_INTERVAL_HOURS` hours via APScheduler.
They are saved to `./backups/` as `timescheduler_YYYYMMDD_HHMMSS.dump`.

To trigger a manual backup:
```bash
curl -X POST http://localhost:8000/api/backup/run \
  -H "Authorization: Bearer <your_token>"
```

To restore:
```bash
pg_restore -h localhost -U ts_user -d timescheduler ./backups/timescheduler_20260101_120000.dump
```

---

## Known notes

- **Route ordering:** `/api/tasks/reorder` must be declared **before** `/api/tasks/{task_id}` in FastAPI to avoid `"reorder"` being parsed as an integer.
- **Timezone:** All datetimes are stored as UTC in PostgreSQL. The frontend converts to local time using `new Date(isoString)` for display.
- **Single user:** The app is designed for one primary user. Multiple users can be created via the admin panel but all share the same workspace.
- **`CLEAN_DB_ON_STARTUP`:** Set to `true` once to wipe all data and recreate the admin account. Set back to `false` immediately after.
