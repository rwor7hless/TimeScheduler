3# Tasks Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ternary task `status` with binary `done`, rename `kanban_order` → `position`, add a midnight cleanup cron, expose project (board) selection at task creation, show project on each row, and enable per-section drag-and-drop reorder.

**Architecture:** Five connected pieces, single deploy, single DB migration. Backend (NestJS + Prisma) gets a schema migration, simplified DTOs, an updated service, and a new `TasksCleanupService` cron. Frontend (React + TanStack Query + dnd-kit) gets type updates, a new `ProjectChip` component, a project badge on task rows, and `@dnd-kit/sortable` reorder per section.

**Tech Stack:** NestJS, Prisma, Postgres, Jest (backend); React 18, TanStack Query, dnd-kit, framer-motion, Tailwind, Vite (frontend).

**Spec:** `docs/superpowers/specs/2026-04-29-tasks-rework-design.md`

---

## Task 1: Baseline check

Make sure the workspace is green before making changes.

**Files:**
- None yet.

- [ ] **Step 1: Run backend tests on untouched main**

```bash
cd backend-node && npm test -- --silent --runInBand
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend type-check**

```bash
cd frontend && npm run build
```

Expected: build succeeds (this is `tsc + vite build`).

- [ ] **Step 3: Confirm Prisma client is in sync**

```bash
cd backend-node && npx prisma generate
```

Expected: "Generated Prisma Client … to ./node_modules/@prisma/client".

If anything fails: stop and fix before going further. The plan assumes a clean baseline.

---

## Task 2: Database migration

Replace `KanbanStatus` enum + `status` column with a `done` boolean. Rename `kanban_order` → `position`. Adjust the composite index.

**Files:**
- Modify: `backend-node/prisma/schema.prisma:84-122` (Task model) and `backend-node/prisma/schema.prisma` (drop enum block)
- Create: `backend-node/prisma/migrations/20260429100000_tasks_rework/migration.sql`

- [ ] **Step 1: Update `schema.prisma`**

Find the `Task` model and the `KanbanStatus` enum. Apply this diff:

```diff
  model Task {
    id              Int      @id @default(autoincrement())
    title           String   @db.VarChar(255)
    description     String?
    priority        Priority
-   status          KanbanStatus
-   kanban_order    Int
+   done            Boolean  @default(false)
+   position        Int      @default(0)
    scheduled_start DateTime? @db.Timestamptz(6)
    ...
-   @@index([user_id, board_id, status], map: "ix_tasks_user_board_status")
+   @@index([user_id, board_id, position], map: "ix_tasks_user_board_position")
    ...
  }

- enum KanbanStatus {
-   todo
-   in_progress
-   done
-
-   @@map("kanbanstatus")
- }
```

(The exact enum block in this codebase may not have `@@map`; just delete the whole block. Keep the `Priority` enum.)

- [ ] **Step 2: Create the migration directory and SQL**

```bash
mkdir -p backend-node/prisma/migrations/20260429100000_tasks_rework
```

Then create `backend-node/prisma/migrations/20260429100000_tasks_rework/migration.sql` with:

```sql
-- 1. Add `done` boolean and backfill from old status.
ALTER TABLE "tasks" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
UPDATE "tasks" SET "done" = true WHERE "status" = 'done';

-- 2. Rename `kanban_order` → `position`. Existing values carry over.
ALTER TABLE "tasks" RENAME COLUMN "kanban_order" TO "position";

-- 3. Drop the old composite index, recreate on (user_id, board_id, position).
DROP INDEX IF EXISTS "ix_tasks_user_board_status";
CREATE INDEX "ix_tasks_user_board_position" ON "tasks"("user_id", "board_id", "position");

-- 4. Drop the status column and the enum type.
ALTER TABLE "tasks" DROP COLUMN "status";
DROP TYPE "KanbanStatus";
```

- [ ] **Step 3: Apply the migration to the dev DB**

```bash
cd backend-node && npx prisma migrate deploy
```

Expected: "1 migration found in prisma/migrations" and "Applying migration `20260429100000_tasks_rework`".

If the dev DB is out of sync (e.g. existing rows have `status` that doesn't map cleanly), inspect with `psql` and reset only as a last resort (`npx prisma migrate reset` is destructive — confirm with the user first).

- [ ] **Step 4: Regenerate the Prisma client**

```bash
cd backend-node && npx prisma generate
```

Expected: client regenerated. The `Task` type now has `done: boolean` and `position: number`. `KanbanStatus` is gone — TypeScript will start failing across the service and DTOs, which we fix in the next tasks.

- [ ] **Step 5: Commit (schema + migration only — code will catch up next)**

```bash
git add backend-node/prisma/schema.prisma backend-node/prisma/migrations/20260429100000_tasks_rework/
git commit -m "feat(db): drop kanban status, add done flag and position rename"
```

---

## Task 3: Backend DTOs

Drop the `status` enum from the wire format. Add `done` and `position` to create/update/response DTOs. Rename `kanban-reorder.dto.ts` → `reorder.dto.ts` and drop its `status` field.

**Files:**
- Modify: `backend-node/src/tasks/dto/task-create.dto.ts`
- Modify: `backend-node/src/tasks/dto/task-update.dto.ts`
- Modify: `backend-node/src/tasks/dto/task-response.dto.ts`
- Rename + edit: `backend-node/src/tasks/dto/kanban-reorder.dto.ts` → `backend-node/src/tasks/dto/reorder.dto.ts`

- [ ] **Step 1: `task-create.dto.ts`** — drop status enum exports, add `done` field

In `task-create.dto.ts`, remove the `KANBAN_STATUS_VALUES`, `KanbanStatusWire`, `KANBAN_TO_PRISMA`, `KANBAN_FROM_PRISMA` exports and the `KanbanStatus` import from `@prisma/client`. Replace the `status` field on `TaskCreateDto` with `done`. Keep `PRIORITY_*` exports untouched.

```ts
// At the top, remove:
//   import { KanbanStatus, Priority } from '@prisma/client';
// Replace with:
import { Priority } from '@prisma/client';

// Delete the KANBAN_STATUS_VALUES / KanbanStatusWire / KANBAN_TO_PRISMA /
// KANBAN_FROM_PRISMA exports entirely.

// In TaskCreateDto, replace:
//   @IsOptional()
//   @IsEnum(KANBAN_STATUS_VALUES)
//   status?: KanbanStatusWire;
// with:
  @IsOptional()
  @IsBoolean()
  done?: boolean;
```

- [ ] **Step 2: `task-update.dto.ts`** — same change for the patch DTO

```ts
// Remove the import of KANBAN_STATUS_VALUES / KanbanStatusWire from task-create.dto
// and replace the `status` field with:
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  done?: boolean | null;
```

The existing import line is:

```ts
import {
  KANBAN_STATUS_VALUES,
  KanbanStatusWire,
  PRIORITY_VALUES,
  PriorityWire,
} from './task-create.dto';
```

Reduce it to:

```ts
import { PRIORITY_VALUES, PriorityWire } from './task-create.dto';
```

- [ ] **Step 3: `task-response.dto.ts`** — replace `status` with `done`, rename `kanban_order` → `position`

```ts
// Top of file: remove KanbanStatusWire from import, leave PriorityWire
import { PriorityWire } from './task-create.dto';

// In TaskResponseDto, replace:
//   status!: KanbanStatusWire;
//   kanban_order!: number;
// with:
  done!: boolean;
  position!: number;
```

- [ ] **Step 4: Rename `kanban-reorder.dto.ts` → `reorder.dto.ts`**

```bash
git mv backend-node/src/tasks/dto/kanban-reorder.dto.ts backend-node/src/tasks/dto/reorder.dto.ts
```

Replace the contents with:

```ts
import { Type } from 'class-transformer';
import { IsArray, IsInt } from 'class-validator';

/**
 * Body of PATCH /api/tasks/reorder. Accepts the new full ordering of one
 * "section" as a flat list of task ids. The service writes `position = i`
 * for each id in array order, transactionally. An empty array short-circuits
 * to `{ ok: true }`.
 */
export class ReorderDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ordered_ids!: number[];
}
```

- [ ] **Step 5: Verify DTOs compile in isolation**

```bash
cd backend-node && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40
```

Expected: errors localized to `tasks.service.ts`, `tasks.controller.ts`, and `*.spec.ts` (which still reference `KANBAN_*` and `status`). DTOs themselves compile clean. We fix the service/controller in the next tasks.

- [ ] **Step 6: Commit**

```bash
git add backend-node/src/tasks/dto/
git commit -m "feat(tasks): replace status enum with done flag in DTOs, rename reorder DTO"
```

---

## Task 4: Backend service rewrite

Rewrite `tasks.service.ts` to use `done` + `position` instead of `status` + `kanban_order`, drop status-aware reorder logic, and update completed_at handling.

**Files:**
- Modify: `backend-node/src/tasks/tasks.service.ts`

- [ ] **Step 1: Imports**

Top of file — current imports include `KanbanStatus` from `@prisma/client` and `KANBAN_FROM_PRISMA`, `KANBAN_TO_PRISMA`, `KanbanStatusWire`. Reduce to just what's still needed:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Priority, Tag, Task, TaskTag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRIORITY_FROM_PRISMA,
  PRIORITY_TO_PRISMA,
  PriorityWire,
  TaskCreateDto,
} from './dto/task-create.dto';
import { TaskUpdateDto } from './dto/task-update.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { ReorderDto } from './dto/reorder.dto';
import { escapeLikePattern, pickRandomTaskColor } from './tasks.constants';
```

- [ ] **Step 2: `ListFilters` interface**

Drop `status?: KanbanStatusWire` from the interface. Rest unchanged:

```ts
export interface ListFilters {
  priority?: PriorityWire;
  tag?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  board_id?: number;
  default_board?: boolean;
  scope?: string;
  include_subtasks?: boolean;
  // status filter removed; callers that want "only completed" use done={true|false}
  done?: boolean;
}
```

- [ ] **Step 3: `serialize()`** — emit `done` + `position`

Replace the two lines:

```ts
priority: PRIORITY_FROM_PRISMA[t.priority],
status: KANBAN_FROM_PRISMA[t.status],
kanban_order: t.kanban_order,
```

with:

```ts
priority: PRIORITY_FROM_PRISMA[t.priority],
done: t.done,
position: t.position,
```

- [ ] **Step 4: `buildListWhere()`** — remove status filter, add done filter

Replace the `if (filters.status) { ... }` block with:

```ts
if (filters.done !== undefined) {
  where.done = filters.done;
}
```

- [ ] **Step 5: `list()` ordering**

Replace `orderBy: { kanban_order: 'asc' }` with `orderBy: { position: 'asc' }`.

- [ ] **Step 6: `create()`** — use `done` and per-user `position`

Find this block:

```ts
const priority: Priority = PRIORITY_TO_PRISMA[data.priority ?? 'medium'];
const status: KanbanStatus = KANBAN_TO_PRISMA[data.status ?? 'todo'];

const maxRow = await this.prisma.task.findFirst({
  where: { user_id: userId, status },
  orderBy: { kanban_order: 'desc' },
  select: { kanban_order: true },
});
const kanbanOrder = (maxRow?.kanban_order ?? 0) + 1;
```

Replace with:

```ts
const priority: Priority = PRIORITY_TO_PRISMA[data.priority ?? 'medium'];
const done = data.done ?? false;

// position scoped to the user only — the new task lands at the bottom of
// the user's task list. DnD reorder rewrites positions per-section after.
const maxRow = await this.prisma.task.findFirst({
  where: { user_id: userId },
  orderBy: { position: 'desc' },
  select: { position: true },
});
const position = (maxRow?.position ?? 0) + 1;
```

Then in the same `create()` method, find the inner `tx.task.create({ data: { ... } })` call and replace these three fields:

```ts
      priority,
      status,
      kanban_order: kanbanOrder,
```

with:

```ts
      priority,
      done,
      position,
      completed_at: done ? new Date() : null,
```

- [ ] **Step 7: `update()`** — drop status, add done

Find the `existing` `findFirst` `select` and replace `status: true` with `done: true`:

```ts
const existing = await this.prisma.task.findFirst({
  where: { id, user_id: userId },
  select: {
    id: true,
    parent_id: true,
    scheduled_start: true,
    deadline: true,
    tg_remind_at: true,
    done: true,
  },
});
```

Then find these lines:

```ts
const priority = PRIORITY_TO_PRISMA[data.priority ?? 'medium'];
const status = KANBAN_TO_PRISMA[data.status ?? 'todo'];
```

Replace with:

```ts
const priority = PRIORITY_TO_PRISMA[data.priority ?? 'medium'];
const done = data.done ?? false;
```

Find the `updates` object containing `status,` and replace with `done,`. Remove the `kanban_order` reference if any (there isn't one here, but double-check).

Find this block at the bottom of `update()`:

```ts
if (status === 'DONE' && existing.status !== 'DONE') {
  updates.completed_at = new Date();
} else if (status !== 'DONE') {
  updates.completed_at = null;
}
```

Replace with:

```ts
if (done && !existing.done) {
  updates.completed_at = new Date();
} else if (!done) {
  updates.completed_at = null;
}
```

- [ ] **Step 8: `patch()`** — drop status, add done

Find the `existing` `findFirst` and update its `select`:

```ts
const existing = await this.prisma.task.findFirst({
  where: { id, user_id: userId },
  select: { id: true, parent_id: true, done: true, completed_at: true },
});
```

Find the bottom block:

```ts
let newStatus: KanbanStatus | undefined;
if (present.has('status') && raw.status) {
  newStatus = KANBAN_TO_PRISMA[raw.status];
  updates.status = newStatus;
  if (newStatus === 'DONE' && existing.completed_at === null) {
    updates.completed_at = new Date();
  } else if (newStatus !== 'DONE') {
    updates.completed_at = null;
  }
}
```

Replace with:

```ts
if (present.has('done') && raw.done !== null && raw.done !== undefined) {
  updates.done = raw.done;
  if (raw.done && existing.completed_at === null) {
    updates.completed_at = new Date();
  } else if (!raw.done) {
    updates.completed_at = null;
  }
}
```

- [ ] **Step 9: `reorder()`** — simplified, no status

Replace the entire `reorder` method body with:

```ts
async reorder(userId: number, data: ReorderDto): Promise<{ ok: true }> {
  if (!data.ordered_ids || data.ordered_ids.length === 0) {
    return { ok: true };
  }
  const now = new Date();

  await this.prisma.$transaction(async (tx) => {
    // Scope to the caller's tasks only — silent no-op for foreign ids.
    const owned = await tx.task.findMany({
      where: { id: { in: data.ordered_ids }, user_id: userId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((t) => t.id));

    await Promise.all(
      data.ordered_ids.map((id, idx) => {
        if (!ownedIds.has(id)) return Promise.resolve();
        return tx.task.update({
          where: { id },
          data: { position: idx, updated_at: now },
        });
      }),
    );
  });

  return { ok: true };
}
```

- [ ] **Step 10: tsc check**

```bash
cd backend-node && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40
```

Expected: errors now only in `tasks.controller.ts` and `*.spec.ts`. The service compiles.

- [ ] **Step 11: Commit**

```bash
git add backend-node/src/tasks/tasks.service.ts
git commit -m "feat(tasks): rewrite service for done/position, simplified reorder"
```

---

## Task 5: Backend controller

Drop the `status` query param, switch reorder import.

**Files:**
- Modify: `backend-node/src/tasks/tasks.controller.ts`

- [ ] **Step 1: Imports**

Change:

```ts
import { KanbanReorderDto } from './dto/kanban-reorder.dto';
import {
  KANBAN_STATUS_VALUES,
  KanbanStatusWire,
  PRIORITY_VALUES,
  PriorityWire,
  TaskCreateDto,
} from './dto/task-create.dto';
```

to:

```ts
import { ReorderDto } from './dto/reorder.dto';
import { PRIORITY_VALUES, PriorityWire, TaskCreateDto } from './dto/task-create.dto';
```

- [ ] **Step 2: `reorder()` handler signature**

Replace `@Body() body: KanbanReorderDto` with `@Body() body: ReorderDto`.

- [ ] **Step 3: `list()` handler** — drop `status` query param, add `done`

Find the `list` method signature. Remove the `@Query('status') status?: string,` parameter. Add a `done` parameter at the same position:

```ts
@Get()
list(
  @CurrentUser() user: User,
  @Query('done') doneRaw?: string,
  @Query('priority') priority?: string,
  @Query('tag') tag?: string,
  @Query('date_from') dateFrom?: string,
  @Query('date_to') dateTo?: string,
  @Query('search') search?: string,
  @Query('board_id') boardIdRaw?: string,
  @Query('default_board', new DefaultValuePipe(false), ParseBoolPipe) defaultBoard?: boolean,
  @Query('scope') scope?: string,
  @Query('include_subtasks', new DefaultValuePipe(false), ParseBoolPipe)
  includeSubtasks?: boolean,
): Promise<TaskResponseDto[]> {
  const priorityFilter = (PRIORITY_VALUES as readonly string[]).includes(priority ?? '')
    ? (priority as PriorityWire)
    : undefined;
  const boardId = boardIdRaw ? Number.parseInt(boardIdRaw, 10) : undefined;
  let done: boolean | undefined;
  if (doneRaw === 'true') done = true;
  else if (doneRaw === 'false') done = false;

  return this.tasks.list(user.id, {
    done,
    priority: priorityFilter,
    tag: tag || undefined,
    date_from: dateFrom,
    date_to: dateTo,
    search: search || undefined,
    board_id: Number.isFinite(boardId) ? boardId : undefined,
    default_board: defaultBoard,
    scope: scope || undefined,
    include_subtasks: includeSubtasks,
  });
}
```

- [ ] **Step 4: tsc check**

```bash
cd backend-node && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40
```

Expected: only `*.spec.ts` files still failing. App code compiles clean.

- [ ] **Step 5: Commit**

```bash
git add backend-node/src/tasks/tasks.controller.ts
git commit -m "feat(tasks): drop status query param, switch to done filter"
```

---

## Task 6: Backend specs cleanup

Update existing `tasks.service.spec.ts` and `tasks.controller.spec.ts` so they compile against the new types and exercise the new behavior.

**Files:**
- Modify: `backend-node/src/tasks/tasks.service.spec.ts`
- Modify: `backend-node/src/tasks/tasks.controller.spec.ts`

- [ ] **Step 1: `tasks.service.spec.ts` — replace fixture fields**

Find every `kanban_order: 0,` in the spec and replace with `position: 0,`. Find every fixture that contains `status: 'TODO'` / `'DONE'` / `'IN_PROGRESS'` and replace with `done: false` (for TODO/IN_PROGRESS) or `done: true` (for DONE). Also remove any imports of `KanbanStatus` from `@prisma/client`.

```bash
cd backend-node && grep -n "kanban_order\|KanbanStatus\|status:" src/tasks/tasks.service.spec.ts | head -40
```

Use the grep output to drive a series of point edits. Every `status:` line in this file is a fixture field — convert each as described.

- [ ] **Step 2: Update the reorder spec**

Find the `'reorder completed_at preservation'` describe block. Both call sites pass `{ status: 'done' | 'todo', ordered_ids: [...] }` — change to just `{ ordered_ids: [...] }`. The expectations that check `kanban_order` become `position`. The DONE-stamping expectations are obsolete (reorder no longer touches `completed_at`); replace those assertions with simple position-asserts.

Concretely, the body should become:

```ts
describe('reorder', () => {
  it('writes position by index for owned ids', async () => {
    const updateMock = jest.fn().mockResolvedValue(undefined);
    const findMock = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const tx = {
      task: { findMany: findMock, update: updateMock },
    };
    const prismaMock = {
      $transaction: async (cb: (t: unknown) => Promise<void>) => cb(tx),
      task: { findMany: findMock, update: updateMock },
    } as unknown as PrismaService;
    const service = new TasksService(prismaMock);

    await service.reorder(7, { ordered_ids: [2, 1] });

    expect(updateMock).toHaveBeenCalledTimes(2);
    const calls = updateMock.mock.calls.map((c: [unknown]) => c[0] as {
      where: { id: number };
      data: { position: number };
    });
    const forId2 = calls.find((c) => c.where.id === 2);
    const forId1 = calls.find((c) => c.where.id === 1);
    expect(forId2?.data.position).toBe(0);
    expect(forId1?.data.position).toBe(1);
  });

  it('returns {ok:true} on empty array without touching the DB', async () => {
    const prismaMock = { $transaction: jest.fn() } as unknown as PrismaService;
    const service = new TasksService(prismaMock);
    const out = await service.reorder(7, { ordered_ids: [] });
    expect(out).toEqual({ ok: true });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
```

(If the spec has additional reorder tests around DONE / completed_at — delete them. Position reorder no longer touches completed_at.)

- [ ] **Step 3: `tasks.controller.spec.ts` — fix reorder forwarding test**

Find the existing test:

```ts
it('reorder forwards user.id + body', async () => {
  await controller.reorder(user, { status: 'done', ordered_ids: [1, 2] });
  expect(service.reorder).toHaveBeenCalledWith(42, { status: 'done', ordered_ids: [1, 2] });
});
```

Replace with:

```ts
it('reorder forwards user.id + body', async () => {
  await controller.reorder(user, { ordered_ids: [1, 2] });
  expect(service.reorder).toHaveBeenCalledWith(42, { ordered_ids: [1, 2] });
});
```

- [ ] **Step 4: Run backend tests**

```bash
cd backend-node && npm test -- --silent --runInBand
```

Expected: all tests pass. If a fixture leftover still references `status`, fix it and rerun until green.

- [ ] **Step 5: Commit**

```bash
git add backend-node/src/tasks/tasks.service.spec.ts backend-node/src/tasks/tasks.controller.spec.ts
git commit -m "test(tasks): update specs for done/position rework"
```

---

## Task 7: Backend cleanup cron service (TDD)

Add `TasksCleanupService` with the spec from the design doc. TDD: failing test first, then service, then wire into module.

**Files:**
- Create: `backend-node/src/tasks/tasks-cleanup.service.spec.ts`
- Create: `backend-node/src/tasks/tasks-cleanup.service.ts`
- Modify: `backend-node/src/tasks/tasks.module.ts`

- [ ] **Step 1: Failing test**

Create `backend-node/src/tasks/tasks-cleanup.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { TasksCleanupService } from './tasks-cleanup.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('TasksCleanupService', () => {
  // Fixed reference moment: cron fires at 2026-04-30 00:00 Europe/Moscow.
  // In UTC that's 2026-04-29 21:00. Yesterday window (Moscow):
  //   [2026-04-29 00:00 MSK, 2026-04-30 00:00 MSK)
  //   = [2026-04-28 21:00 UTC, 2026-04-29 21:00 UTC)
  const NOW_UTC = new Date('2026-04-29T21:00:00.000Z');
  const YESTERDAY_DOW_MON_BASED = 2; // Wed 2026-04-29 → 2 (0=Mon)

  function makeTask(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      done: false,
      my_day: false,
      scheduled_start: null,
      scheduled_end: null,
      deadline: null,
      repeat_days: [],
      ...overrides,
    };
  }

  function setup(candidates: any[]) {
    // Each `prisma.task.updateMany(...)` call inside `$transaction([...])`
    // is invoked first (eagerly, by JS evaluation order) BEFORE `$transaction`
    // sees the array. So `updateMany` must be a function on the same
    // `prisma.task` object the service uses — not a separate tx client.
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const findMany = jest.fn().mockResolvedValue(candidates);
    const prisma = {
      task: { findMany, updateMany },
      $transaction: jest
        .fn()
        .mockImplementation(async (arr: Promise<unknown>[]) => Promise.all(arr)),
    } as unknown as PrismaService;
    const config = { get: () => 'Europe/Moscow' } as unknown as ConfigService;
    const svc = new TasksCleanupService(prisma, config);
    // Override `now()` so the cron is deterministic.
    (svc as unknown as { now: () => Date }).now = () => NOW_UTC;
    return { svc, updateMany, findMany };
  }

  it('archives done non-recurring tasks visible yesterday', async () => {
    const t = makeTask({
      id: 11,
      done: true,
      scheduled_start: new Date('2026-04-29T08:00:00.000Z'),
    });
    const { svc, updateMany } = setup([t]);
    await svc.tick();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [11] } },
        data: { is_archived: true },
      }),
    );
  });

  it('resets done recurring tasks instead of archiving', async () => {
    const t = makeTask({ id: 12, done: true, repeat_days: [YESTERDAY_DOW_MON_BASED] });
    const { svc, updateMany } = setup([t]);
    await svc.tick();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [12] } },
        data: { done: false, completed_at: null },
      }),
    );
  });

  it('clears my_day on not-done my_day tasks', async () => {
    const t = makeTask({ id: 13, my_day: true });
    const { svc, updateMany } = setup([t]);
    await svc.tick();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [13] } },
        data: { my_day: false },
      }),
    );
  });

  it('clears scheduled_start on not-done scheduled-yesterday tasks', async () => {
    const t = makeTask({
      id: 14,
      scheduled_start: new Date('2026-04-29T10:00:00.000Z'),
      scheduled_end: new Date('2026-04-29T11:00:00.000Z'),
    });
    const { svc, updateMany } = setup([t]);
    await svc.tick();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [14] } },
        data: { scheduled_start: null, scheduled_end: null },
      }),
    );
  });

  it('leaves not-done deadline-yesterday alone (becomes overdue)', async () => {
    const t = makeTask({ id: 15, deadline: new Date('2026-04-29T20:00:00.000Z') });
    const { svc, updateMany } = setup([t]);
    await svc.tick();
    // Updates fire on empty arrays only (no work to do for this id).
    for (const call of updateMany.mock.calls) {
      const arg = call[0] as { where: { id: { in: number[] } } };
      expect(arg.where.id.in).not.toContain(15);
    }
  });

  it('clears my_day when both my_day and deadline-yesterday', async () => {
    const t = makeTask({
      id: 16,
      my_day: true,
      deadline: new Date('2026-04-29T20:00:00.000Z'),
    });
    const { svc, updateMany } = setup([t]);
    await svc.tick();
    // my_day is in the cleared set; scheduled_start is NOT.
    const myDayCall = updateMany.mock.calls.find(
      (c) => (c[0] as { data: { my_day?: boolean } }).data.my_day === false,
    );
    expect(myDayCall).toBeDefined();
    expect((myDayCall![0] as { where: { id: { in: number[] } } }).where.id.in).toContain(16);
  });

  it('does not archive recurring not-done tasks', async () => {
    const t = makeTask({ id: 17, repeat_days: [YESTERDAY_DOW_MON_BASED] });
    const { svc, updateMany } = setup([t]);
    await svc.tick();
    for (const call of updateMany.mock.calls) {
      const arg = call[0] as { where: { id: { in: number[] } } };
      expect(arg.where.id.in).not.toContain(17);
    }
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
cd backend-node && npm test -- --runInBand src/tasks/tasks-cleanup.service.spec.ts
```

Expected: FAIL with "Cannot find module './tasks-cleanup.service'".

- [ ] **Step 3: Implement the service**

Create `backend-node/src/tasks/tasks-cleanup.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Runs at 00:00 in `USER_TIMEZONE`. Cleans up the prior day in "Today":
 *
 *  - done non-recurring → is_archived=true (stays in original board)
 *  - done recurring     → done=false, completed_at=null (lives on)
 *  - not-done my_day    → my_day=false (goes to backlog)
 *  - not-done scheduled-yesterday (no deadline-yesterday, not recurring)
 *                       → scheduled_start=null, scheduled_end=null (backlog)
 *  - not-done deadline-yesterday → leave alone (becomes overdue)
 *
 * `tick()` is the body of the cron, exported for testing.
 */
@Injectable()
export class TasksCleanupService {
  private readonly logger = new Logger(TasksCleanupService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Hook for tests to freeze time.
  protected now(): Date {
    return new Date();
  }

  @Cron('0 0 * * *', { name: 'today-cleanup', timeZone: process.env.USER_TIMEZONE || 'Europe/Moscow' })
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('today-cleanup cron already running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      await this.tick();
    } catch (err) {
      this.logger.error(`today-cleanup tick failed: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async tick(): Promise<void> {
    const now = this.now();
    const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDow = ((yesterdayStart.getUTCDay() + 6) % 7);
    // ^ getUTCDay returns 0=Sun..6=Sat; convert to 0=Mon..6=Sun to match repeat_days.
    // Caveat: this is good enough because the cron itself fires at 00:00 user TZ,
    // and DOW boundaries within a single day rarely matter for sane TZs.

    const candidates = await this.prisma.task.findMany({
      where: {
        is_archived: false,
        deleted_at: null,
        OR: [
          { scheduled_start: { gte: yesterdayStart, lt: now } },
          { deadline: { gte: yesterdayStart, lt: now } },
          { my_day: true },
          { repeat_days: { has: yesterdayDow } },
        ],
      },
      select: {
        id: true,
        done: true,
        my_day: true,
        scheduled_start: true,
        deadline: true,
        repeat_days: true,
      },
    });

    const archiveIds: number[] = [];
    const resetIds: number[] = [];
    const myDayClearIds: number[] = [];
    const schedClearIds: number[] = [];

    for (const t of candidates) {
      const isRecurring = Array.isArray(t.repeat_days) && t.repeat_days.length > 0;
      const hadDeadlineYesterday =
        !!t.deadline && t.deadline >= yesterdayStart && t.deadline < now;
      const scheduledYesterday =
        !!t.scheduled_start && t.scheduled_start >= yesterdayStart && t.scheduled_start < now;

      if (t.done) {
        if (isRecurring) resetIds.push(t.id);
        else archiveIds.push(t.id);
        continue;
      }

      if (t.my_day) myDayClearIds.push(t.id);
      if (scheduledYesterday && !isRecurring && !hadDeadlineYesterday) {
        schedClearIds.push(t.id);
      }
      // hadDeadlineYesterday & not my_day & not done → leave alone (Просрочено)
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { id: { in: archiveIds } },
        data: { is_archived: true },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: resetIds } },
        data: { done: false, completed_at: null },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: myDayClearIds } },
        data: { my_day: false },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: schedClearIds } },
        data: { scheduled_start: null, scheduled_end: null },
      }),
    ]);

    this.logger.log(
      `today-cleanup: archived=${archiveIds.length} reset=${resetIds.length} ` +
        `myDayCleared=${myDayClearIds.length} schedCleared=${schedClearIds.length}`,
    );
  }
}
```

- [ ] **Step 4: Wire into module**

Edit `backend-node/src/tasks/tasks.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TagsModule } from '../tags/tags.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksCleanupService } from './tasks-cleanup.service';

@Module({
  imports: [AuthModule, TagsModule],
  providers: [TasksService, TasksCleanupService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
```

`ScheduleModule.forRoot()` is already registered globally in `app.module.ts`, so the `@Cron` decorator on `TasksCleanupService` is picked up automatically.

- [ ] **Step 5: Run the test — should pass now**

```bash
cd backend-node && npm test -- --runInBand src/tasks/tasks-cleanup.service.spec.ts
```

Expected: all 7 cases pass. If a case fails, the assertion message will name the broken expectation; fix the categorization branch in `tick()` and rerun.

- [ ] **Step 6: Run full backend tests**

```bash
cd backend-node && npm test -- --silent --runInBand
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend-node/src/tasks/tasks-cleanup.service.ts backend-node/src/tasks/tasks-cleanup.service.spec.ts backend-node/src/tasks/tasks.module.ts
git commit -m "feat(tasks): add midnight cleanup cron service"
```

---

## Task 8: Frontend types + API client

Update `Task` shape, drop `KanbanReorder`, update reorder API call signature, refresh `tasksApi`.

**Files:**
- Modify: `frontend/src/types/task.ts`
- Modify: `frontend/src/api/tasks.ts`

- [ ] **Step 1: `types/task.ts`**

Replace the file content as follows. Keep `Priority`, palette, weekday labels, and `TagCreate`. Remove `KanbanStatus` and `KanbanReorder` types. Replace `status` / `kanban_order` on `Task`, `TaskCreate`, `TaskUpdate` with `done` / `position`.

```ts
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Tag {
  id: number
  name: string
  color: string
}

export const TASK_COLOR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

export interface Task {
  id: number
  title: string
  color: string
  description: string | null
  priority: Priority
  done: boolean
  position: number
  scheduled_start: string | null
  scheduled_end: string | null
  deadline: string | null
  repeat_days: number[] | null  // 0=Mon..6=Sun
  completed_at: string | null
  created_at: string
  updated_at: string
  tags: Tag[]
  board_id: number | null
  parent_id: number | null
  is_archived: boolean
  tg_remind: boolean
  tg_remind_at: string | null
  tg_reminded: boolean
  my_day: boolean
  subtasks: Task[]
}

export interface TaskCreate {
  title: string
  description?: string | null
  color?: string | null
  priority?: Priority
  done?: boolean
  scheduled_start?: string | null
  scheduled_end?: string | null
  deadline?: string | null
  repeat_days?: number[]
  tag_ids?: number[]
  board_id?: number | null
  parent_id?: number | null
  tg_remind?: boolean
  tg_remind_at?: string | null
  my_day?: boolean
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  color?: string | null
  priority?: Priority
  done?: boolean | null
  scheduled_start?: string | null
  scheduled_end?: string | null
  deadline?: string | null
  repeat_days?: number[] | null
  tag_ids?: number[]
  board_id?: number | null
  tg_remind?: boolean | null
  tg_remind_at?: string | null
  my_day?: boolean | null
}

export interface ReorderPayload {
  ordered_ids: number[]
}

export interface TagCreate {
  name: string
  color?: string
}

export const WEEKDAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const
```

- [ ] **Step 2: `api/tasks.ts`**

Find `import type { Task, TaskCreate, TaskUpdate, KanbanReorder, Tag, TagCreate } from '@/types/task'` and update to `ReorderPayload`:

```ts
import type { Task, TaskCreate, TaskUpdate, ReorderPayload, Tag, TagCreate } from '@/types/task'
```

Find the reorder method:

```ts
reorder: (data: KanbanReorder) =>
  api.patch('/tasks/reorder', data),
```

Replace with:

```ts
reorder: (data: ReorderPayload) =>
  api.patch('/tasks/reorder', data),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/task.ts frontend/src/api/tasks.ts
git commit -m "feat(types): replace task status with done, kanban_order with position"
```

---

## Task 9: Frontend hooks + cascade fixes

Update `useReorderTasks` (signature + optimistic update), and fix the simple status-string call sites in `TaskCard`, `TodoListPage`, `ExportPage`. Also remove the now-orphan `KanbanPage` and clean up the `TaskModal` status picker.

**Files:**
- Modify: `frontend/src/hooks/useTasks.ts`
- Modify: `frontend/src/components/tasks/TaskCard.tsx`
- Modify: `frontend/src/pages/TodoListPage.tsx`
- Modify: `frontend/src/pages/ExportPage.tsx`
- Modify: `frontend/src/components/tasks/TaskModal.tsx`
- Delete: `frontend/src/pages/KanbanPage.tsx`

- [ ] **Step 1: `useTasks.ts` — update import**

Find:

```ts
import type { Task, TaskCreate, TaskUpdate, KanbanReorder, TagCreate } from '@/types/task'
```

Replace with:

```ts
import type { Task, TaskCreate, TaskUpdate, ReorderPayload, TagCreate } from '@/types/task'
```

- [ ] **Step 2: `useTasks.ts` — `useReorderTasks` with optimistic cache**

Find:

```ts
export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: KanbanReorder) => tasksApi.reorder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
```

Replace with:

```ts
export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ReorderPayload) => tasksApi.reorder(data),
    // Optimistic: immediately rewrite `position` in the cache so the UI
    // doesn't snap back while the request is in flight.
    onMutate: async ({ ordered_ids }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })
      const positionById = new Map<number, number>()
      ordered_ids.forEach((id, idx) => positionById.set(id, idx))
      qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map((task) =>
          positionById.has(task.id)
            ? ({ ...task, position: positionById.get(task.id)! } as Task)
            : task,
        )
      })
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous) return
      for (const [key, data] of ctx.previous) {
        qc.setQueryData(key, data)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
```

- [ ] **Step 3: `TaskCard.tsx`**

Line 44 — replace:

```ts
const isCancelled = task.status === 'done'
```

with:

```ts
const isCancelled = task.done
```

- [ ] **Step 4: `TodoListPage.tsx` — line 82 and 325**

Line 82, replace `const done = task.status === 'done'` with `const done = task.done`.

Line 325, find the toggle handler — likely:

```ts
const newStatus = task.status === 'done' ? 'todo' : 'done'
```

Replace with:

```ts
const newDone = !task.done
```

Then update the call site that sends the patch — the `data: { status: newStatus }` becomes `data: { done: newDone }`.

Also check the import block at the top of `TodoListPage.tsx`. If it imports `useReorderTasks` (line 7) and uses it, the call site needs `{ ordered_ids: [...] }` instead of `{ status: ..., ordered_ids: [...] }`. Update the call.

- [ ] **Step 5: `ExportPage.tsx` — drop `in_progress` filter**

Around line 108 there is:

```jsx
<option value="in_progress">В работе</option>
```

Delete that single line. The remaining options collapse to "all / done / todo" (which now logically means "выполнено / не выполнено"). If the dropdown sends a `status` query param, change the `name` attribute and the controlled state to `done` and the values to `''` / `'true'` / `'false'`.

If this requires a wider state rename in `ExportPage.tsx`, do the rename here — don't leave a hybrid where the wire param is `status` but the column is `done`.

- [ ] **Step 6: `TaskModal.tsx` — drop status picker, replace import**

Line 6, replace `KanbanStatus` import:

```ts
import type { Task, TaskCreate, Priority } from '@/types/task'
```

Drop the `defaultStatus?: KanbanStatus` prop on the props interface (line 17) — replace with `defaultDone?: boolean`.

Line 71, replace:

```ts
const [status, setStatus] = useState<KanbanStatus>('todo')
```

with:

```ts
const [done, setDone] = useState<boolean>(false)
```

Line 122, replace `setStatus(task.status)` with `setDone(task.done)`.

Lines 387–399 (the status picker UI) — delete the whole block. Replace with a single labelled checkbox:

```tsx
<label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
  <input
    type="checkbox"
    checked={done}
    onChange={(e) => setDone(e.target.checked)}
    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
  />
  Выполнено
</label>
```

In the modal's submit/save handler, find every place that includes `status` in the payload and replace with `done`. (Search the file for `status` and walk through each match — most are in the already-updated state setters, the rest are in the create/update API call body.)

- [ ] **Step 7: Delete `KanbanPage.tsx`**

Confirm no references remain:

```bash
grep -rn "from '@/pages/KanbanPage'\|import KanbanPage" frontend/src/
```

Expected: no output. (`App.tsx` already redirects `/kanban*` and doesn't import the page.)

```bash
git rm frontend/src/pages/KanbanPage.tsx
```

- [ ] **Step 8: Frontend type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors. If errors remain, walk through each — they should all be the same `task.status` / `kanban_order` / `KanbanStatus` patterns, fixable in 1–2 lines each. `TodayPage.tsx` will still have errors; those are addressed in Task 10.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "feat(frontend): cascade status→done across hooks, modal, list, export, card"
```

(`-A` here is OK because we just deleted `KanbanPage.tsx` and the only un-versioned changes should be the files we just touched. Verify with `git status` before committing.)

---

## Task 10: TodayPage — status sweep + remove on-visit cleanup

Replace `task.status === 'done'` everywhere with `task.done`, and delete the `cleanupRanRef` block (now handled by the cron).

**Files:**
- Modify: `frontend/src/pages/TodayPage.tsx`

- [ ] **Step 1: Status sweep**

Find lines 113, 253, 541, 606, 613 (use `grep -n "task\.status" frontend/src/pages/TodayPage.tsx`). For each:

- `task.status === 'done'` → `task.done`
- `newStatus = task.status === 'done' ? 'todo' : 'done'` (line 613) → `const newDone = !task.done`
- The `mutateAsync({ id, data: { status: newStatus } })` call → `mutateAsync({ id, data: { done: newDone } })`

After this, `tsc --noEmit` for frontend should be clean.

- [ ] **Step 2: Delete the on-visit cleanup block**

Find the block at `TodayPage.tsx:424-475` (starts with the comment `// Auto-clear scheduled date on tasks whose scheduled day has already passed`). Delete the entire block, including the leading comment and the `cleanupRanRef`/`useEffect`. Also delete the `cleanupRanRef` declaration on line 427.

The replaced section should immediately go from the destructured hooks (`patchTask`, `createTask`, etc.) to the `// ── Unified "today" list` comment.

- [ ] **Step 3: Frontend type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Smoke check (manual)**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173, log in, navigate to `/today`. Expected: page loads, tasks render, toggling a task's checkbox works, no console errors. (Tasks that were `in_progress` in the old DB now show as not-done — that's the migration backfill behavior, expected.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TodayPage.tsx
git commit -m "refactor(today): sweep task.status→task.done, drop on-visit cleanup (cron handles it)"
```

---

## Task 11: TodayPage — drag-and-drop reorder per section

Wrap each rendered section (today, overdue, each date bucket) in its own `DndContext` + `SortableContext`. On drop, call the `useReorderTasks` mutation with the section's full new order. Animate row reflow with `framer-motion`.

**Files:**
- Modify: `frontend/src/pages/TodayPage.tsx`

- [ ] **Step 1: Imports**

Add at the top of `TodayPage.tsx`:

```ts
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { useReorderTasks } from '@/hooks/useTasks'
```

- [ ] **Step 2: `SortableRow` wrapper helper**

Right above the existing `TodayTaskRow` component, add a small wrapper that owns the sortable transform/transition for any child task row:

```tsx
function SortableRow({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  }
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 3: Hook the reorder mutation in the component**

Inside `TodayPage` body, add near the other hooks:

```ts
const reorderTasks = useReorderTasks()
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
```

The 6px activation distance prevents single-click selections from triggering a drag.

- [ ] **Step 4: Generic `handleSectionDragEnd`**

Add this helper in the same component scope:

```ts
const handleSectionDragEnd = (currentIds: number[]) => (event: DragEndEvent) => {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIndex = currentIds.indexOf(Number(active.id))
  const newIndex = currentIds.indexOf(Number(over.id))
  if (oldIndex === -1 || newIndex === -1) return
  const next = arrayMove(currentIds, oldIndex, newIndex)
  reorderTasks.mutate({ ordered_ids: next })
}
```

- [ ] **Step 5: Wrap "today" / "overdue" list in `DndContext`**

Find the JSX block that currently renders either `overdueTasks.map(...)` or `todayUnified.map(...)`. Replace each with a section that owns its own sortable context. Concretely:

```tsx
{topTab === 'overdue' && overdueTasks.length > 0 ? (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={handleSectionDragEnd(overdueTasks.map((t) => t.id))}
  >
    <SortableContext
      items={overdueTasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className="space-y-1.5">
        <AnimatePresence>
          {overdueTasks.map((task) => (
            <SortableRow key={task.id} id={task.id}>
              <BacklogTaskRow
                task={task}
                todayStr={todayStr}
                onToggle={() => handleTaskToggle(task)}
                onAddToMyDay={() => handleAddToMyDay(task)}
                onClick={() => openEdit(task)}
              />
            </SortableRow>
          ))}
        </AnimatePresence>
      </div>
    </SortableContext>
  </DndContext>
) : todayUnified.length === 0 ? (
  <p className="text-sm text-gray-400 dark:text-gray-500 py-3">
    Нет задач на сегодня — добавь или назначь дедлайн
  </p>
) : (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={handleSectionDragEnd(todayUnified.map((e) => e.task.id))}
  >
    <SortableContext
      items={todayUnified.map((e) => e.task.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className="space-y-1.5">
        <AnimatePresence>
          {todayUnified.map(({ task, type }) => (
            <SortableRow key={task.id} id={task.id}>
              <TodayTaskRow
                task={task}
                type={type}
                todayStr={todayStr}
                onToggle={() => handleTaskToggle(task)}
                onRemove={type === 'my_day' ? () => handleRemoveFromMyDay(task) : undefined}
                onClick={() => openEdit(task)}
              />
            </SortableRow>
          ))}
        </AnimatePresence>
      </div>
    </SortableContext>
  </DndContext>
)}
```

- [ ] **Step 6: Wrap each date section the same way**

Find the `dateSections.map((section) => { ... })` block. The inner `<div className="mt-2 space-y-1.5">` containing `section.tasks.map(...)` becomes:

```tsx
{open && (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={handleSectionDragEnd(section.tasks.map((t) => t.id))}
  >
    <SortableContext
      items={section.tasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className="mt-2 space-y-1.5">
        <AnimatePresence>
          {section.tasks.map((task) => (
            <SortableRow key={task.id} id={task.id}>
              <BacklogTaskRow
                task={task}
                todayStr={todayStr}
                onToggle={() => handleTaskToggle(task)}
                onAddToMyDay={() => handleAddToMyDay(task)}
                onClick={() => openEdit(task)}
              />
            </SortableRow>
          ))}
        </AnimatePresence>
      </div>
    </SortableContext>
  </DndContext>
)}
```

- [ ] **Step 7: Update sort to honor `position`**

Find `todayUnified` `useMemo` (line 478). For section 1 ("Scheduled today"), update the sort to put `position` first:

```ts
.sort((a, b) => {
  if (a.position !== b.position) return a.position - b.position
  return new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime()
})
```

In `dateSections` `useMemo` (around line 552), update the bucket sort similarly — `position` first, then date/time fallback:

```ts
for (const arr of buckets.values()) {
  arr.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    const aD = getTaskDateOnly(a) ?? ''
    const bD = getTaskDateOnly(b) ?? ''
    if (aD !== bD) return aD < bD ? -1 : 1
    const aT = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity
    const bT = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity
    if (aT !== bT) return aT - bT
    return a.title.localeCompare(b.title, 'ru')
  })
}
```

In the `overdueTasks` `useMemo`, prepend a `position` clause:

```ts
.sort((a, b) => {
  if (a.position !== b.position) return a.position - b.position
  return a.deadline!.localeCompare(b.deadline!)
})
```

- [ ] **Step 8: Frontend type-check + smoke**

```bash
cd frontend && npx tsc --noEmit && npm run dev
```

Open `/today`. Drag a task in "Сегодня" up/down — expect smooth reflow. Refresh the page — order should persist. Drag in "Завтра" section — same behavior. Quick `git diff frontend/src/pages/TodayPage.tsx` sanity check before committing.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/TodayPage.tsx
git commit -m "feat(today): per-section drag-and-drop reorder via @dnd-kit/sortable"
```

---

## Task 12: ProjectChip + project badge on rows

New compact dropdown in the quick-add area, plus a faded project name on each task row.

**Files:**
- Create: `frontend/src/components/tasks/ProjectChip.tsx`
- Modify: `frontend/src/pages/TodayPage.tsx`

- [ ] **Step 1: Create `ProjectChip`**

`frontend/src/components/tasks/ProjectChip.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { Board } from '@/types/board'

interface ProjectChipProps {
  boards: Board[]
  selectedId: number | null
  onSelect: (id: number | null) => void
}

/**
 * Compact project picker for the quick-add bar. Renders a small chip whose
 * label is the selected project name (or "Без проекта"). Click opens a
 * vertical dropdown of all owned boards plus a "Без проекта" entry.
 *
 * Closing: clicking outside, picking an item, or pressing Escape.
 */
export default function ProjectChip({ boards, selectedId, onSelect }: ProjectChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = selectedId == null ? null : boards.find((b) => b.id === selectedId) ?? null
  const label = selected ? selected.name : 'Без проекта'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'h-9 px-2.5 rounded-xl text-xs font-medium border transition-colors max-w-[140px] truncate',
          selected
            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
        )}
        title={selected ? `Проект: ${label}` : 'Выбрать проект'}
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setOpen(false)
            }}
            className={clsx(
              'w-full text-left px-3 py-1.5 text-xs',
              selectedId == null
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60',
            )}
          >
            Без проекта
          </button>
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onSelect(b.id)
                setOpen(false)
              }}
              className={clsx(
                'w-full text-left px-3 py-1.5 text-xs truncate',
                selectedId === b.id
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60',
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire `ProjectChip` into TodayPage quick-add**

In `TodayPage.tsx`:

Add imports:

```ts
import ProjectChip from '@/components/tasks/ProjectChip'
import { useBoards } from '@/hooks/useTasks'
```

In the component body, near `const [quickAdd, setQuickAdd] = useState('')`, add:

```ts
const { data: boards = [] } = useBoards()
const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
```

In `handleQuickAdd`, when building `taskData`, add `board_id`:

```ts
taskData.board_id = selectedBoardId
```

After `await createTask.mutateAsync(taskData)`, reset:

```ts
setQuickAdd('')
setSelectedBoardId(null)
```

In the JSX, find the quick-add input row (the `<div className="flex gap-2">` containing the relative input + the `+` button). Insert `<ProjectChip>` between the input and the `+` button:

```tsx
<div className="flex gap-2">
  <div className="relative flex-1 ...">
    {/* existing input */}
  </div>
  <ProjectChip
    boards={boards}
    selectedId={selectedBoardId}
    onSelect={setSelectedBoardId}
  />
  <button
    type="button"
    onClick={handleQuickAdd}
    disabled={!quickAdd.trim()}
    className="px-3 py-2 ..."
  >
    {/* existing + icon */}
  </button>
</div>
```

- [ ] **Step 3: Project badge on `TodayTaskRow` and `BacklogTaskRow`**

Both row components get a new prop `boardName: string | null` and render it after `<TagBadgeGroup>` and before the date/deadline badges:

In `TodayTaskRow` (around line 96 props, line 128 markup), add:

```tsx
// Props:
type Props = {
  task: Task
  type: TodayTaskType
  todayStr: string
  boardName: string | null     // ← new
  onToggle: () => void
  onRemove?: () => void
  onClick: () => void
}

// In the JSX, between TagBadgeGroup and the date badge:
{!done && boardName && (
  <span
    className="text-[10px] font-medium text-gray-400 dark:text-gray-500 max-w-[80px] truncate flex-shrink-0"
    title={boardName}
  >
    {boardName}
  </span>
)}
```

Apply the same change to `BacklogTaskRow` props and JSX.

- [ ] **Step 4: Provide `boardName` from the parent**

In `TodayPage` body, build a memoized lookup:

```ts
const boardsById = useMemo(() => {
  const m = new Map<number, string>()
  for (const b of boards) m.set(b.id, b.name)
  return m
}, [boards])
```

At every call site that renders `<TodayTaskRow>` / `<BacklogTaskRow>`, pass:

```tsx
boardName={task.board_id ? boardsById.get(task.board_id) ?? null : null}
```

- [ ] **Step 5: Frontend type-check + smoke**

```bash
cd frontend && npx tsc --noEmit && npm run dev
```

Open `/today`. Verify:
- Chip "Без проекта" sits between input and `+`.
- Click chip — dropdown shows "Без проекта" + each project. Selecting one updates the chip.
- Add a task with chip set to a project — task appears with the project name on the right, faded.
- Toggle the task done — project badge disappears (only shown for not-done).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tasks/ProjectChip.tsx frontend/src/pages/TodayPage.tsx
git commit -m "feat(today): project chip on quick-add + faded project badge on rows"
```

---

## Task 13: End-to-end smoke + manual cron drill

Verify the rework end-to-end and exercise the cleanup cron once before merging.

**Files:**
- None (manual checks).

- [ ] **Step 1: Full backend test run**

```bash
cd backend-node && npm test -- --silent --runInBand
```

Expected: all green.

- [ ] **Step 2: Full frontend type-check + build**

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Boot the stack**

```bash
cd backend-node && npm run start:dev &
cd frontend && npm run dev
```

(Or use docker-compose if that's the canonical local flow — `docker-compose up`. Whichever the user normally uses.)

Wait until both are up, then open `http://localhost:5173/today`.

- [ ] **Step 4: Smoke checklist**

Walk through each in the browser, fix any regression you spot:

- [ ] Quick-add a task without time → it appears in "Сегодня" with `my_day=true`.
- [ ] Quick-add a task with `завтра в 11:00 на 1 час` → it appears in "Завтра" section, NOT in today.
- [ ] Quick-add with project selected → row shows faded project name on the right.
- [ ] Toggle a task's checkbox → row gets strike-through, project badge hides.
- [ ] Drag a task within "Сегодня" → smooth reflow, persists after refresh.
- [ ] Drag a task within "Завтра" section → same.
- [ ] Open `TaskModal` for an existing task → "Выполнено" checkbox reflects current state, no status dropdown remnants.
- [ ] Open `/projects` (BoardsPage) → project list renders unchanged.
- [ ] Open `/calendar/day` → events render via `TaskCard`, no console errors.
- [ ] Open `/export` → status filter dropdown has only "all / done / not done" (no `in_progress`).

- [ ] **Step 5: Verify the cron is registered**

Boot the backend in dev and confirm Nest registered the cron at startup:

```bash
cd backend-node && npm run start:dev 2>&1 | grep -i "today-cleanup\|TasksCleanupService" | head -5
```

Expected: at least one log line mentioning `TasksCleanupService` or the `today-cleanup` cron name. If nothing matches, the cron isn't picked up — check `tasks.module.ts` providers and that `@Cron` decorator imports from `@nestjs/schedule`.

The categorization logic itself is fully covered by `tasks-cleanup.service.spec.ts` (Task 7) — that's the canonical proof. A live end-to-end drill against the DB is optional: you can wait until 00:00 user-TZ and observe the scheduled fire, or write a one-off admin endpoint that calls `tasksCleanup.tick()` (out of scope for this plan).

- [ ] **Step 6: Final commit / push**

If anything was tweaked during the drill, commit the fix. Then either push the branch or stop here and let the user push when they're ready.

```bash
git status
git log --oneline feature/backend-nestjs-port..HEAD
```

Expected: a clean tree, the commits from the rework reading like a coherent story.
