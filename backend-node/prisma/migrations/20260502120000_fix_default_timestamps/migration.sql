-- Fix server-side defaults that were captured as frozen literal timestamps by
-- the original Alembic migration generation (SQLAlchemy `server_default=func.now()`
-- renders to a literal at generation time). With those frozen defaults, any
-- INSERT that omits `created_at`/`updated_at`/`completed_at`/`sent_at` got
-- stamped with a date from early 2026 — most visibly: weekly_reports always
-- showed `created_at = 2026-04-12 14:16:40`. Switch every such default to
-- CURRENT_TIMESTAMP so DB-level defaults are now actually "now".
--
-- Existing rows are NOT modified — only the column DEFAULT clause is replaced.
-- New INSERTs that bypass the DB default (most do) are unaffected.

ALTER TABLE "users"               ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "boards"              ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "boards"              ALTER COLUMN "updated_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "tasks"               ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "tasks"               ALTER COLUMN "updated_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "habits"              ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "habit_logs"          ALTER COLUMN "completed_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "telegram_keys"       ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "budget_categories"   ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "budget_allocations"  ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "budget_alert_log"    ALTER COLUMN "sent_at"      SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transactions"        ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "planned_purchases"   ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "recurring_transactions" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "weekly_reports"      ALTER COLUMN "created_at"   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "weekly_reports"      ALTER COLUMN "updated_at"   SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill the one row the user already saw stamped 2026-04-12 — copy
-- updated_at into created_at if it's still the frozen default. updated_at
-- itself is set to NOW() at update sites, so it is more meaningful.
UPDATE "weekly_reports"
   SET "created_at" = "updated_at"
 WHERE "created_at" = '2026-04-12 14:16:40.225559+00'::timestamptz
   AND "updated_at" <> '2026-04-12 14:16:40.225559+00'::timestamptz;
