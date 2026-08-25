# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeScheduler is a personal task/habit scheduling app with a NestJS + Prisma backend and React frontend. It is a single-user application (though multi-user with admin/regular roles is supported at the model level).

## Architecture

### Backend (`backend-node/`)
- **NestJS** (Express platform, `@nestjs/platform-express`) with **Prisma** as the ORM, against the same PostgreSQL database the old FastAPI backend used. There is no `backend/` directory in this repo any more — the Python/FastAPI/SQLAlchemy/Alembic stack it used to describe was fully retired once this branch's cutover completed (see `backend-node/CUTOVER.md` for how the swap happened; it documents the now-completed A/B rollout, not a future one)
- **Prisma Migrate** owns schema migrations, under `backend-node/prisma/migrations/`. There's no in-process "run migrations on boot" step inside the Nest app itself — the production Docker image runs `npx prisma migrate deploy` as the first part of its container `CMD`, before starting the server (`backend-node/Dockerfile.node`)
- **`@nestjs/schedule`** runs background jobs: weekly AI report (Sunday 21:00 in `USER_TIMEZONE`, `ReportsSchedulerService`), Telegram reminders (every minute, `TelegramRemindersService`), and — dev-only, active only when `TELEGRAM_WEBHOOK_URL` is unset — a 30s Telegram long-poll fallback (`TelegramPollingFallbackService`, in-memory cursor). DB backups (local-disk and, optionally, S3) are scheduled from `BackupModule`
- On startup, `BootstrapModule` runs three `OnApplicationBootstrap` providers in declared order: `CleanDbService` (truncates all `public`-schema tables if `CLEAN_DB_ON_STARTUP=true`), `StuckReportsService` (resets any `in_progress` weekly reports orphaned by a crashed previous run), then `AdminBootstrapService` (creates the admin user from `USER_LOGIN`/`USER_PASSWORD` if missing, or rehashes the password if it changed — skipped with a warning if either var is unset)
- All routes are prefixed with `/api` (`app.setGlobalPrefix('api')` in `main.ts`) and use JWT Bearer auth via Passport's `jwt` strategy. `JwtAuthGuard` and `AdminGuard` (`backend-node/src/auth/guards/`) are the route guards; `@CurrentUser()` (`backend-node/src/auth/decorators/current-user.decorator.ts`) injects the authenticated Prisma `User` row onto the request
- Config is loaded via `@nestjs/config`'s `ConfigModule`, reading `.env` from the repo root (the same file the old Python backend read) — see `backend-node/.env.example` for the full key reference
- A global `AllExceptionsFilter` (`backend-node/src/common/filters/`) normalizes every 4xx/5xx response body to `{detail: <string>}`, matching FastAPI's old `HTTPException` contract, so the frontend's existing `response.data.detail` handling needed no changes

**Key models** (`backend-node/prisma/schema.prisma`):
- `Task` — main entity with priority, schedule (`scheduled_start`/`scheduled_end`), deadline, `repeat_days`, board reference, tags (M2M via `TaskTag`), Telegram reminder fields, archive flag, subtasks (self-FK `parent_id`, cascade delete)
- `Habit` + `HabitLog` — habit tracking with daily logs
- `Board` + `BoardGroup` — kanban boards, optionally grouped; tasks belong to a board via `board_id` (`SET NULL` on delete)
- `Tag` — per-user tags with color, linked to tasks via the `TaskTag` join table
- `User` — auth; `telegram_chat_id` / `telegram_key` stored here after Telegram linkage; `can_request_summary` gates weekly-report eligibility
- `TelegramKey` — one-time keys for linking user accounts to Telegram
- `TelegramState` — marked `@deprecated` in the schema: held the long-poll cursor for the old always-on Python poller. No longer written — see the Telegram bullet in Key Conventions below
- `Transaction`, `PlannedPurchase`, `RecurringTransaction`, `BudgetCategory`, `BudgetTag`, `BudgetAllocation`, `BudgetAlertLog`, plus two join tables (`TransactionTag`, `PlannedTag`) — backend-persisted budget data; no frontend page consumes it (see Pages, below)
- `WeeklyReport` — generated AI weekly summaries; `status` is a free-form `VarChar` mirroring the `pending`/`in_progress`/`done`/`error` FSM (not a DB enum)
- `alembic_version` — legacy marker table declared with `@@ignore` purely so `prisma migrate diff` stays drift-aware; the Python/Alembic stack it belonged to no longer exists in this repo

**Module structure** (`backend-node/src/`, one Nest module per domain, wired in `app.module.ts`): `auth`, `admin`, `boards`, `board-groups`, `tags`, `tasks`, `habits`, `llm`, `ntfy`, `reports`, `budget` (one `BudgetModule`, internally organized into `categories`/`tags`/`transactions`/`planned`/`recurring`/`allocations`/`history`/`summary`/`export`/`crons` subdirectories, each usually its own controller/service pair, not separate Nest modules), `telegram`, `stats`, `search`, `export`, `backup`, `bootstrap`. A bare `HealthController` provides an unauthenticated health check.

**LLM integration:** `backend-node/src/llm/llm.service.ts` is a provider-agnostic OpenAI-compatible client (ported from the old `backend/app/services/gigachat.py`, hence `gigachat` surviving as a `LLM_PROVIDER` value name even though the file it came from is gone), built on the `openai` npm package. `LLM_PROVIDER` selects between `gigachat` (cloud.ru foundation-models, `GIGACHAT_API_KEY`) and `nvidia` (NVIDIA NIM `integrate.api.nvidia.com`, `NVIDIA_API_KEY`). Both expose `/v1/chat/completions`, so only `base_url`/`api_key`/model name differ. Errors are mapped to plain `Error`s with human-readable messages — call sites translate them to HTTP 503. There is no `GET /reports/daily-tip` endpoint — it doesn't exist in `reports.controller.ts`/`report-stream.controller.ts`, and no frontend hook calls it either.

### Frontend (`frontend/`)
- **React 18** + **TypeScript** + **Vite**
- **TanStack Query** for server state; queries live in `src/hooks/`
- **Axios** client at `src/api/client.ts` with JWT interceptor; proxies `/api` to `localhost:8000` in dev
- Path alias `@` maps to `src/`
- **Tailwind CSS** for styling
- **dnd-kit** for drag-and-drop (kanban)
- **recharts** for stats visualizations (used by `StatsPeriodView.tsx` and `HabitsPage.tsx`)
- **framer-motion** for animations
- Two themes (`dark` default, `light`), defined in `src/styles/tokens.ts` and switched via `ThemeContext` — the sidebar calls `useTheme().toggle()` directly, there is no `ThemePicker` component

**Pages:** Today, Tasks (`/tasks`, plus a per-board list view at `/list/:boardId`), Calendar (day/week/month views), Habits, Stats, Notifications, Admin. There is no Boards or Kanban screen: `/boards` and `/kanban` are legacy redirects in `App.tsx` to `/today` and `/tasks` respectively, with no page component behind them (no `BoardsPage.tsx` or `KanbanPage.tsx` exists in `src/pages/`). There is also no `/export` route and no `ExportPage.tsx` — the screen was deleted once the terminal redesign reached it, since nothing routed to it. The backend endpoints it used (`GET /api/export/tasks`, `GET /api/export/stats`) are untouched and still answer. (Notes were dropped from the schema before the Node port — there's no `Notes` model in `prisma/schema.prisma` — and removed from the UI. Budget has no frontend page — the API and all 9 Prisma budget models, two of which are join tables, remain unconsumed by the UI.)

**Auth flow:** JWT stored in `localStorage`. On 401 response, the axios interceptor (`src/api/client.ts`) shows a toast and redirects to `/login` after a short delay. `AuthContext` provides `isAuthenticated` and `isAdmin`.

**localStorage-only state:** Theme preference (`ThemeContext`) and last-seen-reports timestamp (`useReports`).

## Development Commands

### Backend
```bash
cd backend-node
npm install
npm run start:dev             # nest start --watch; dev server on :4000 by default (PORT env var)
npx prisma migrate deploy     # apply migrations manually
npx prisma migrate dev --name <description>   # create + apply a new migration locally
npm run build                 # nest build -> dist/main.js
npm test                      # jest — runs src/**/*.spec.ts and test/**/*.e2e-spec.ts together
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # dev server on :5173 (proxies /api to :8000)
npm run build    # tsc + vite build
```

## Configuration

Environment variables (`.env` at repo root, read via `@nestjs/config`'s `ConfigModule`; see `backend-node/.env.example` for the full reference map — that file's values are all commented out, it's documentation, not a template to copy verbatim):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL_PRISMA` | *(required — Prisma throws if missing)* | Prisma's datasource URL (`postgresql://...`), what `schema.prisma` actually connects with |
| `DATABASE_URL` | falls back to `DATABASE_URL_PRISMA` | Kept in the old SQLAlchemy `postgresql+asyncpg://` form; used by the backup pipeline (`pg_dump`/S3 backup) |
| `SECRET_KEY` | *(required — `getOrThrow`, app fails to boot without it)* | JWT signing key. Same value the retired Python backend used, so old tokens still verify |
| `USER_LOGIN` / `USER_PASSWORD` | *(none — admin bootstrap is skipped with a logged warning if either is unset)* | Admin credentials; `AdminBootstrapService` creates or rehashes the admin user from these on every boot |
| `JWT_EXPIRE_MINUTES` | `43200` (30 days) | Token lifetime; unset or non-numeric values fall back to the default |
| `PORT` | `4000` | HTTP port `main.ts` listens on |
| `CORS_ORIGINS` | `*` | Comma-separated allow-list; a literal `*` combined with `NODE_ENV=production` logs a warning (credentialed requests get reflected from any origin) |
| `TELEGRAM_BOT_TOKEN` | `` | Optional; enables Telegram features |
| `TELEGRAM_WEBHOOK_URL` / `TELEGRAM_WEBHOOK_SECRET` | `` | When set, Telegram runs in webhook mode (`WebhookSetupService` registers the webhook on boot); when unset, the dev-only long-poll fallback is used instead |
| `CLEAN_DB_ON_STARTUP` | `false` | ⚠️ Truncates every `public`-schema table except `_prisma_migrations`/`alembic_version` on next startup (one-time reset). 3-sec warning delay in logs. |
| `BACKUP_INTERVAL_HOURS` | `24` | Local-disk DB backup frequency |
| `BACKUP_DIR` | `./backups` | Local-disk backup storage path |
| `USER_TIMEZONE` | `Europe/Moscow` | Timezone for the weekly-report cron and Telegram reminder display |
| `LLM_PROVIDER` | `gigachat` | `gigachat` or `nvidia` — picks which OpenAI-compatible backend is used. |
| `GIGACHAT_API_KEY` | `` | API key for cloud.ru GigaChat (used when `LLM_PROVIDER=gigachat`). Empty disables LLM features. |
| `NVIDIA_API_KEY` | `` | API key for NVIDIA NIM (used when `LLM_PROVIDER=nvidia`). |
| `NTFY_TOPIC` | `` | ntfy.sh topic for mobile push notifications (empty disables) |
| `NTFY_SERVER` | `https://ntfy.sh` | ntfy server URL |

Not in the table above: an optional S3-backup feature reads its own set of vars (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_PREFIX`, `BACKUP_RETENTION_DAYS`, `BACKUP_LIFECYCLE_RULE_ID`, `BACKUP_NOTIFY_CHAT_ID`, `BACKUP_NOTIFY_ON_SUCCESS`, `S3_DEBUG`) — see `backend-node/src/backup/s3-backup.config.ts` for the authoritative list; they aren't yet documented in `.env.example`. Also note `JWT_ALGORITHM`, listed in `.env.example`, is not read anywhere in `backend-node/src` — the algorithm is hardcoded to `HS256` in both `AuthModule` and `JwtStrategy`.

## Key Conventions

- All DB timestamps are stored as UTC. The Telegram reminder service converts to `USER_TIMEZONE` for display.
- `repeat_days` on `Task` is a Postgres `integer[]` column (Prisma type `Int[]`) where 0=Monday, 6=Sunday. Prisma scalar lists can't be nullable, so a NULL column value reads back as `[]`.
- New migrations are created with `npx prisma migrate dev --name <description>` from `backend-node/`, which generates a timestamp-named folder under `backend-node/prisma/migrations/` (e.g. `20260502120000_fix_default_timestamps`) containing the generated `migration.sql`. There's no manual filename/revision-id convention to maintain, unlike the retired Alembic setup.
- Migrations are applied with `npx prisma migrate deploy`, run as the first step of the production Docker container's `CMD` (`backend-node/Dockerfile.node`) before the server starts — not from inside the Nest app itself the way the old FastAPI startup hook did.
- `CLEAN_DB_ON_STARTUP=true` (case-insensitive) makes `CleanDbService` query `pg_catalog.pg_tables` for every `public`-schema table except `_prisma_migrations`/`alembic_version`, then run `TRUNCATE ONLY ... RESTART IDENTITY CASCADE` on all of them. Logs a warning and sleeps 3 sec first. Should only be set once for a reset, then removed.
- Report status is a free-form `VarChar` on `WeeklyReport.status` (not a DB enum) following the `pending` → `in_progress` → `done`/`error` FSM. `GET /api/reports/:id/stream` (`report-stream.controller.ts`) atomically transitions it to `in_progress` on entry; a parallel call gets a 409 via `ConflictException`.
- Telegram runs in webhook mode by default (`TelegramWebhookController`, registered on boot by `WebhookSetupService`); the `telegram_state` table is deprecated and no longer written. A dev-only fallback (`TelegramPollingFallbackService`) long-polls every 30s only when `TELEGRAM_WEBHOOK_URL` is unset, keeping its `last_update_id` cursor in memory instead of the DB.
