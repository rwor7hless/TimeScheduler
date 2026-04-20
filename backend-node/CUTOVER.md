# Backend Cutover — Python (FastAPI) → Node (NestJS + Prisma)

## Goals

Flip `/api` traffic from the Python backend (port 8000) to the Node backend (port 4000) with **one-command rollback** and no data migration. Both backends share the same PostgreSQL database and JWT secret, so the switch is purely routing.

---

## Pre-cutover checklist

- [ ] All phases green locally: `cd backend-node && npm run lint && npm run build && npm test` exits 0 (289+ tests).
- [ ] DB port `5433` published on the host via the updated `docker-compose.yml` (replaces the Phase 1 `ts-pg-proxy` socat workaround).
- [ ] `ts-pg-proxy` socat container stopped/removed (optional but recommended).
- [ ] Real repo-root `.env` has every key enumerated in `backend-node/.env.example` — in particular `DATABASE_URL_PRISMA`, `SECRET_KEY` (shared with Python), `TELEGRAM_WEBHOOK_SECRET` (if webhooks are enabled).
- [ ] Contract sweep: hit every endpoint against Python (`:8000`) and Node (`:4000`), diff the JSON bodies. Postman / newman or a hand-rolled script both work.

---

## Cutover steps (zero-downtime A/B)

1. **Bring Node up alongside Python.**
   ```bash
   docker compose up -d backend-node
   ```
   Node listens on `:4000`. Python keeps serving on `:8000`. Frontend is unchanged.

2. **Validate Node end-to-end.** Curl-pass every endpoint:
   `/api/auth/token`, `/api/auth/me`, `/api/tasks`, `/api/tasks/reorder`,
   `/api/boards`, `/api/tags`, `/api/habits/{id}/log`, `/api/stats`,
   `/api/export/json`, `/api/backup/run`, `/api/reports/daily-tip`,
   `/api/reports/{id}/stream` (SSE), `/api/budget/*`, `/api/search`,
   `/api/telegram/*`. Compare body shapes to Python.

3. **Point the frontend at Node.** Dev only:
   - Edit `frontend/vite.config.ts` to proxy `/api` -> `http://localhost:4000`, or
   - If you run behind nginx/Caddy, flip the upstream to `backend-node:4000`.

4. **Production flip.** Edit `docker-compose.yml`:
   - Swap `backend-node` ports to `8000:4000` (claims the public port).
   - Stop the Python `backend` service, or remap it to `8001:8000` for shadow traffic.
   - Restart only the frontend if its upstream is hostname-based.

5. **Monitor for 24h.** Spot-check LLM/SSE streaming, Telegram webhook delivery, scheduled backups, weekly-report cron.

---

## Rollback (single command)

If anything goes wrong during the A/B period:

```bash
docker compose stop backend-node && docker compose up -d backend
```

Python resumes on `:8000` against the same database. No state conversion, no JWT reissue, no frontend redeploy needed.

---

## Week-1 invariants that keep rollback safe

- **No destructive Prisma migrations.** Only the `0_baseline` migration has shipped. The schema matches Python's last Alembic revision byte-for-byte.
- **`alembic_version` table untouched.** If you roll back to Python, its startup `alembic upgrade head` is still a no-op.
- **Argon2 password hashes are portable.** Python (`pwdlib[argon2]`) and Node (`@node-rs/argon2`) produce/verify the same `$argon2id$...` format. Existing users log in on either backend.
- **JWT `SECRET_KEY` is shared.** Tokens issued by Python verify on Node and vice versa (same HS256 + same secret).
- **Schema frozen since Phase 1 baseline.** Any schema evolution happens post-cutover, using Prisma migrations from that point on.

---

## After 1 week of clean running

- Delete the Python `backend` service from `docker-compose.yml`.
- Delete the `backend/` directory from the repo.
- Leave `alembic_version` in the DB as archaeology — Prisma migrations take over going forward.
- Open a follow-up ticket to rename `backend-node/` → `backend/` if desired.
- Delete `DATABASE_URL` from `.env`; keep only `DATABASE_URL_PRISMA`.
