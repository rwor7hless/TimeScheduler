-- Tasks rework: replace ternary KanbanStatus with `done` boolean,
-- rename `kanban_order` → `position`, swap composite index.

-- 1. Add `done` boolean (default false) and backfill from old status.
ALTER TABLE "tasks" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
UPDATE "tasks" SET "done" = true WHERE "status" = 'DONE';

-- 2. Rename `kanban_order` → `position`. Existing values carry over so
-- the prior order is preserved as the initial position per task.
ALTER TABLE "tasks" RENAME COLUMN "kanban_order" TO "position";

-- 3. Drop the old composite index, recreate on (user_id, board_id, position).
DROP INDEX IF EXISTS "ix_tasks_user_board_status";
CREATE INDEX "ix_tasks_user_board_position" ON "tasks"("user_id", "board_id", "position");

-- 4. Drop the status column and the enum type.
ALTER TABLE "tasks" DROP COLUMN "status";
DROP TYPE "kanbanstatus";
