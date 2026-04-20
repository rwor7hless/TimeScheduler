-- CreateEnum
CREATE TYPE "priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "kanbanstatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "alembic_version" (
    "version_num" VARCHAR(32) NOT NULL,

    CONSTRAINT "alembic_version_pkc" PRIMARY KEY ("version_num")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_admin" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 11:36:45.220039+00'::timestamp with time zone,
    "telegram_chat_id" VARCHAR(50),
    "telegram_key" VARCHAR(64),
    "can_request_summary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 12:34:05.725675+00'::timestamp with time zone,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 12:34:05.725675+00'::timestamp with time zone,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "priority" "priority" NOT NULL,
    "status" "kanbanstatus" NOT NULL,
    "kanban_order" INTEGER NOT NULL,
    "scheduled_start" TIMESTAMPTZ(6),
    "scheduled_end" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 09:13:13.055616+00'::timestamp with time zone,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 09:13:13.055616+00'::timestamp with time zone,
    "color" VARCHAR(7) DEFAULT '#6B7280',
    "user_id" INTEGER NOT NULL,
    "repeat_days" INTEGER[],
    "board_id" INTEGER,
    "tg_remind" BOOLEAN NOT NULL DEFAULT false,
    "tg_remind_at" TIMESTAMPTZ(6),
    "tg_reminded" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMPTZ(6),
    "parent_id" INTEGER,
    "deleted_at" TIMESTAMPTZ(6),
    "my_day" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tags" (
    "task_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("task_id","tag_id")
);

-- CreateTable
CREATE TABLE "habits" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "color" VARCHAR(7) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 09:13:13.055616+00'::timestamp with time zone,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_logs" (
    "id" SERIAL NOT NULL,
    "habit_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 09:13:13.055616+00'::timestamp with time zone,

    CONSTRAINT "habit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_keys" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "chat_id" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-02-23 23:17:24.162234+00'::timestamp with time zone,

    CONSTRAINT "telegram_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_state" (
    "id" INTEGER NOT NULL,
    "last_update_id" BIGINT NOT NULL,

    CONSTRAINT "telegram_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_tags" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,

    CONSTRAINT "budget_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "icon" VARCHAR(16) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_archived" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-04-19 14:41:16.474209+00'::timestamp with time zone,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_allocations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "limit_amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-03-07 16:20:57.009122+00'::timestamp with time zone,

    CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_alert_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-04-19 14:41:16.474209+00'::timestamp with time zone,

    CONSTRAINT "budget_alert_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" VARCHAR(50),
    "description" VARCHAR(500) NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-03-07 16:20:57.009122+00'::timestamp with time zone,
    "source_planned_id" INTEGER,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_purchases" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" VARCHAR(50),
    "description" VARCHAR(500) NOT NULL,
    "done" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-03-07 16:20:57.009122+00'::timestamp with time zone,
    "source_recurring_id" INTEGER,

    CONSTRAINT "planned_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" VARCHAR(50),
    "description" VARCHAR(500) NOT NULL,
    "tag_ids" INTEGER[],
    "day_of_month" INTEGER NOT NULL,
    "start_date" VARCHAR(10) NOT NULL,
    "end_date" VARCHAR(10),
    "last_generated_date" VARCHAR(10),
    "is_paused" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-04-19 14:41:16.474209+00'::timestamp with time zone,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tags" (
    "transaction_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transaction_id","tag_id")
);

-- CreateTable
CREATE TABLE "planned_tags" (
    "planned_purchase_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "planned_tags_pkey" PRIMARY KEY ("planned_purchase_id","tag_id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "week_start" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "content" TEXT,
    "error_msg" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-04-12 14:16:40.225559+00'::timestamp with time zone,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-04-12 14:16:40.225559+00'::timestamp with time zone,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ix_users_username" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_telegram_key" ON "users"("telegram_key");

-- CreateIndex
CREATE INDEX "ix_boards_user_id" ON "boards"("user_id");

-- CreateIndex
CREATE INDEX "ix_tasks_board_id" ON "tasks"("board_id");

-- CreateIndex
CREATE INDEX "ix_tasks_deleted_at" ON "tasks"("deleted_at");

-- CreateIndex
CREATE INDEX "ix_tasks_parent_id" ON "tasks"("parent_id");

-- CreateIndex
CREATE INDEX "ix_tasks_user_board_status" ON "tasks"("user_id", "board_id", "status");

-- CreateIndex
CREATE INDEX "ix_tasks_user_id" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "ix_tags_user_id" ON "tags"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tag_user_name" ON "tags"("user_id", "name");

-- CreateIndex
CREATE INDEX "ix_habits_user_id" ON "habits"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_habit_date" ON "habit_logs"("habit_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ix_telegram_keys_key" ON "telegram_keys"("key");

-- CreateIndex
CREATE INDEX "ix_budget_tags_user_id" ON "budget_tags"("user_id");

-- CreateIndex
CREATE INDEX "ix_budget_categories_user_id" ON "budget_categories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_budget_category_user_key" ON "budget_categories"("user_id", "key");

-- CreateIndex
CREATE INDEX "ix_budget_allocations_user_id" ON "budget_allocations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_allocations_user_id_year_month_category_key" ON "budget_allocations"("user_id", "year", "month", "category");

-- CreateIndex
CREATE INDEX "ix_budget_alert_log_user_id" ON "budget_alert_log"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alert_once" ON "budget_alert_log"("user_id", "year", "month", "category", "threshold");

-- CreateIndex
CREATE INDEX "ix_transactions_user_id" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "ix_planned_purchases_user_id" ON "planned_purchases"("user_id");

-- CreateIndex
CREATE INDEX "ix_recurring_transactions_user_id" ON "recurring_transactions"("user_id");

-- CreateIndex
CREATE INDEX "ix_weekly_reports_user_id" ON "weekly_reports"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_report_user_week" ON "weekly_reports"("user_id", "week_start");

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_parent_id" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "fk_tags_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "fk_habits_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budget_tags" ADD CONSTRAINT "budget_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budget_alert_log" ADD CONSTRAINT "budget_alert_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planned_purchases" ADD CONSTRAINT "planned_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "budget_tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planned_tags" ADD CONSTRAINT "planned_tags_planned_purchase_id_fkey" FOREIGN KEY ("planned_purchase_id") REFERENCES "planned_purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planned_tags" ADD CONSTRAINT "planned_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "budget_tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

