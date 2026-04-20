import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { KanbanStatus, Prisma, Priority, Tag, Task, TaskTag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  KANBAN_FROM_PRISMA,
  KANBAN_TO_PRISMA,
  KanbanStatusWire,
  PRIORITY_FROM_PRISMA,
  PRIORITY_TO_PRISMA,
  PriorityWire,
  TaskCreateDto,
} from './dto/task-create.dto';
import { TaskUpdateDto } from './dto/task-update.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { KanbanReorderDto } from './dto/kanban-reorder.dto';
import { escapeLikePattern, pickRandomTaskColor } from './tasks.constants';

type TaskTagWithTag = TaskTag & { tags: Tag };
type TaskWithRelations = Task & {
  task_tags: TaskTagWithTag[];
  subtasks?: (Task & { task_tags: TaskTagWithTag[] })[];
};

export interface ListFilters {
  status?: KanbanStatusWire;
  priority?: PriorityWire;
  tag?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  board_id?: number;
  default_board?: boolean;
  scope?: string;
  include_subtasks?: boolean;
}

/**
 * Ports `backend/app/routers/tasks.py`. The largest port of the rewrite;
 * the Python router is 407 lines. Semantics worth flagging:
 *
 * - Default list/get scope excludes soft-deleted (`deleted_at IS NOT NULL`)
 *   and archived rows. Only /archived returns `is_archived=true`.
 * - Subtasks use a self-FK. Circular chains are blocked with a
 *   depth-bounded walk (see `checkCircularParent`).
 * - `repeat_days` collapses `[]` ↔ NULL: Python stores NULL when the input
 *   list is empty; the Prisma Int[] column can't represent NULL but does
 *   accept `[]`. Responses normalize `[]` → `null` to preserve the exact
 *   wire shape the frontend already consumes (`number[] | null`).
 * - Tag assignment uses the explicit `TaskTag` join model. Replace-set
 *   semantics: `deleteMany` + `createMany` inside a transaction.
 * - Enum wire format is lowercase (Python's `str` value of `Priority`/
 *   `KanbanStatus`); Prisma exposes UPPERCASE member names. All DB-facing
 *   code uppercases; all response serialization lowercases.
 */
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma `include` shape that mirrors Python's `_TASK_LOAD_OPTS` —
  // eager-loads tags for the task and for each subtask.
  private readonly loadOpts = {
    task_tags: { include: { tags: true } },
    subtasks: { include: { task_tags: { include: { tags: true } } } },
  } as const;

  // ─── Serialization ──────────────────────────────────────────────────────

  private serializeTag(join: TaskTagWithTag) {
    return { id: join.tags.id, name: join.tags.name, color: join.tags.color };
  }

  private toIso(d: Date | null): string | null {
    return d ? d.toISOString() : null;
  }

  private serialize(t: TaskWithRelations): TaskResponseDto {
    const subtasks = (t.subtasks ?? []).map((s) => this.serialize(s as TaskWithRelations));
    // repeat_days: Prisma returns `[]` when the underlying column is NULL
    // OR when it's an actual empty array. Python stores NULL whenever the
    // list is empty, so both map to `null` on the wire.
    const repeatDays =
      Array.isArray(t.repeat_days) && t.repeat_days.length > 0 ? t.repeat_days : null;
    return {
      id: t.id,
      title: t.title,
      color: t.color ?? '#6B7280',
      description: t.description,
      priority: PRIORITY_FROM_PRISMA[t.priority],
      status: KANBAN_FROM_PRISMA[t.status],
      kanban_order: t.kanban_order,
      scheduled_start: this.toIso(t.scheduled_start),
      scheduled_end: this.toIso(t.scheduled_end),
      deadline: this.toIso(t.deadline),
      repeat_days: repeatDays,
      completed_at: this.toIso(t.completed_at),
      created_at: t.created_at.toISOString(),
      updated_at: t.updated_at.toISOString(),
      tags: (t.task_tags ?? []).map((tt) => this.serializeTag(tt)),
      board_id: t.board_id,
      parent_id: t.parent_id,
      is_archived: t.is_archived,
      tg_remind: t.tg_remind,
      tg_remind_at: this.toIso(t.tg_remind_at),
      tg_reminded: t.tg_reminded,
      my_day: t.my_day,
      subtasks,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private parseDate(v: string | null | undefined): Date | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    return new Date(v);
  }

  private async validateBoardOwnership(
    boardId: number | null | undefined,
    userId: number,
  ): Promise<void> {
    if (boardId === null || boardId === undefined) return;
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, user_id: userId },
      select: { id: true },
    });
    if (!board) {
      throw new NotFoundException('Board not found');
    }
  }

  /**
   * Walks from `parentId` upwards via `parent_id` until it hits NULL, the
   * target `taskId` (→ cycle), or the depth cap (pathological loop
   * insurance). Mirrors `_check_circular_parent` in tasks.py line 35.
   */
  async checkCircularParent(taskId: number, parentId: number): Promise<void> {
    const visited = new Set<number>([taskId]);
    let current: number | null = parentId;
    let depth = 0;
    while (current !== null && depth < 100) {
      if (visited.has(current)) {
        throw new BadRequestException('Circular subtask relationship detected');
      }
      visited.add(current);
      const row: { parent_id: number | null } | null = await this.prisma.task.findUnique({
        where: { id: current },
        select: { parent_id: true },
      });
      if (!row) break;
      current = row.parent_id;
      depth += 1;
    }
  }

  /**
   * Replace the full tag set for a task. Matches Python's
   * `task.tags = list(tag_result.scalars().all())` — the orm rewrites the
   * junction table wholesale. We do the same explicitly because `TaskTag`
   * is modelled as an explicit join.
   */
  private async replaceTags(
    tx: Prisma.TransactionClient,
    taskId: number,
    userId: number,
    tagIds: number[],
  ): Promise<void> {
    await tx.taskTag.deleteMany({ where: { task_id: taskId } });
    if (tagIds.length === 0) return;
    // Only attach tags the caller actually owns — silently drop the rest,
    // matching Python's SELECT-by-(id IN, user_id=self) filter.
    const owned = await tx.tag.findMany({
      where: { id: { in: tagIds }, user_id: userId },
      select: { id: true },
    });
    if (owned.length === 0) return;
    await tx.taskTag.createMany({
      data: owned.map((t) => ({ task_id: taskId, tag_id: t.id })),
      skipDuplicates: true,
    });
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  private buildListWhere(userId: number, filters: ListFilters): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
      user_id: userId,
      is_archived: false,
      deleted_at: null,
    };

    if (!filters.include_subtasks) {
      where.parent_id = null;
    }
    if (filters.scope === 'calendar') {
      where.scheduled_start = { not: null };
    }
    if (filters.status) {
      where.status = KANBAN_TO_PRISMA[filters.status];
    }
    if (filters.priority) {
      where.priority = PRIORITY_TO_PRISMA[filters.priority];
    }
    if (filters.date_from) {
      where.scheduled_start = {
        ...(where.scheduled_start as object),
        gte: new Date(filters.date_from),
      };
    }
    if (filters.date_to) {
      where.scheduled_end = { lte: new Date(filters.date_to) };
    }
    if (filters.search) {
      const escaped = escapeLikePattern(filters.search);
      // Python uses `Task.title.ilike(f"%{escaped}%")` — title only (no
      // description search). Prisma's `contains` with `mode:'insensitive'`
      // maps to `ILIKE '%' || $1 || '%'` — the escaped `%`/`_` inside the
      // user string remain literal because they're part of the $1 param,
      // not concatenated syntax. Verified manually; see service spec.
      where.title = { contains: escaped, mode: 'insensitive' };
    }
    if (filters.tag) {
      where.task_tags = {
        some: { tags: { name: filters.tag, user_id: userId } },
      };
    }
    if (filters.default_board) {
      where.board_id = null;
    } else if (filters.board_id !== undefined) {
      where.board_id = filters.board_id;
    }
    return where;
  }

  async list(userId: number, filters: ListFilters): Promise<TaskResponseDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: this.buildListWhere(userId, filters),
      include: this.loadOpts,
      orderBy: { kanban_order: 'asc' },
    });
    return tasks.map((t) => this.serialize(t as TaskWithRelations));
  }

  async listArchived(userId: number): Promise<TaskResponseDto[]> {
    // Python orders by `completed_at DESC NULLS LAST, updated_at DESC`.
    // Prisma's `nulls: 'last'` is supported since 5.x.
    const tasks = await this.prisma.task.findMany({
      where: { user_id: userId, is_archived: true, deleted_at: null },
      include: this.loadOpts,
      orderBy: [{ completed_at: { sort: 'desc', nulls: 'last' } }, { updated_at: 'desc' }],
    });
    return tasks.map((t) => this.serialize(t as TaskWithRelations));
  }

  async get(userId: number, id: number): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findFirst({
      where: { id, user_id: userId },
      include: this.loadOpts,
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.serialize(task as TaskWithRelations);
  }

  // ─── Mutations ──────────────────────────────────────────────────────────

  async create(userId: number, data: TaskCreateDto): Promise<TaskResponseDto> {
    await this.validateBoardOwnership(data.board_id ?? null, userId);
    if (data.parent_id !== null && data.parent_id !== undefined) {
      const parent = await this.prisma.task.findFirst({
        where: { id: data.parent_id, user_id: userId },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent task not found');
    }

    const priority: Priority = PRIORITY_TO_PRISMA[data.priority ?? 'medium'];
    const status: KanbanStatus = KANBAN_TO_PRISMA[data.status ?? 'todo'];

    // kanban_order = max(kanban_order) + 1 for this column. Scoped to
    // user_id + status, matching tasks.py line 161.
    const maxRow = await this.prisma.task.findFirst({
      where: { user_id: userId, status },
      orderBy: { kanban_order: 'desc' },
      select: { kanban_order: true },
    });
    const kanbanOrder = (maxRow?.kanban_order ?? 0) + 1;

    const repeatDays = data.repeat_days && data.repeat_days.length > 0 ? data.repeat_days : [];

    const taskId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const created = await tx.task.create({
        data: {
          user_id: userId,
          title: data.title,
          description: data.description ?? null,
          color: data.color || pickRandomTaskColor(),
          priority,
          status,
          kanban_order: kanbanOrder,
          scheduled_start: this.parseDate(data.scheduled_start) ?? null,
          scheduled_end: this.parseDate(data.scheduled_end) ?? null,
          deadline: this.parseDate(data.deadline) ?? null,
          repeat_days: repeatDays,
          board_id: data.board_id ?? null,
          parent_id: data.parent_id ?? null,
          tg_remind: data.tg_remind ?? false,
          tg_remind_at: this.parseDate(data.tg_remind_at) ?? null,
          my_day: data.my_day ?? false,
          // Same frozen-default workaround as BoardsService — the schema's
          // dbgenerated literal is a 2026-02 timestamp; we override to now.
          created_at: now,
          updated_at: now,
        },
        select: { id: true },
      });
      if (data.tag_ids && data.tag_ids.length > 0) {
        await this.replaceTags(tx, created.id, userId, data.tag_ids);
      }
      return created.id;
    });

    return this.get(userId, taskId);
  }

  async update(userId: number, id: number, data: TaskCreateDto): Promise<TaskResponseDto> {
    await this.validateBoardOwnership(data.board_id ?? null, userId);
    const existing = await this.prisma.task.findFirst({
      where: { id, user_id: userId },
      select: {
        id: true,
        parent_id: true,
        scheduled_start: true,
        deadline: true,
        tg_remind_at: true,
        status: true,
      },
    });
    if (!existing) throw new NotFoundException('Task not found');

    if (
      data.parent_id !== null &&
      data.parent_id !== undefined &&
      data.parent_id !== existing.parent_id
    ) {
      await this.checkCircularParent(id, data.parent_id);
    }

    const newStart = this.parseDate(data.scheduled_start) ?? null;
    const newDeadline = this.parseDate(data.deadline) ?? null;
    const newRemindAt = this.parseDate(data.tg_remind_at) ?? null;

    const scheduleChanged =
      (existing.scheduled_start?.getTime() ?? null) !== (newStart?.getTime() ?? null) ||
      (existing.deadline?.getTime() ?? null) !== (newDeadline?.getTime() ?? null) ||
      (existing.tg_remind_at?.getTime() ?? null) !== (newRemindAt?.getTime() ?? null);

    const priority = PRIORITY_TO_PRISMA[data.priority ?? 'medium'];
    const status = KANBAN_TO_PRISMA[data.status ?? 'todo'];
    const repeatDays = data.repeat_days && data.repeat_days.length > 0 ? data.repeat_days : [];

    // completed_at transitions: PUT carries a full status, so we know the
    // target state. If moving *into* DONE from non-DONE, stamp now. If
    // moving *out of* DONE, clear. Otherwise leave as-is.
    const updates: Prisma.TaskUpdateInput = {
      title: data.title,
      description: data.description ?? null,
      priority,
      status,
      scheduled_start: newStart,
      scheduled_end: this.parseDate(data.scheduled_end) ?? null,
      deadline: newDeadline,
      repeat_days: { set: repeatDays },
      boards: data.board_id == null ? { disconnect: true } : { connect: { id: data.board_id } },
      parent: data.parent_id == null ? { disconnect: true } : { connect: { id: data.parent_id } },
      tg_remind: data.tg_remind ?? false,
      tg_remind_at: newRemindAt,
      my_day: data.my_day ?? false,
      updated_at: new Date(),
    };
    if (data.color !== null && data.color !== undefined) {
      updates.color = data.color;
    }
    if (scheduleChanged) {
      updates.tg_reminded = false;
    }
    if (status === 'DONE' && existing.status !== 'DONE') {
      updates.completed_at = new Date();
    } else if (status !== 'DONE') {
      updates.completed_at = null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: updates });
      if (data.tag_ids !== undefined) {
        await this.replaceTags(tx, id, userId, data.tag_ids);
      }
    });

    return this.get(userId, id);
  }

  async patch(userId: number, id: number, raw: TaskUpdateDto): Promise<TaskResponseDto> {
    const existing = await this.prisma.task.findFirst({
      where: { id, user_id: userId },
      select: { id: true, parent_id: true, status: true, completed_at: true },
    });
    if (!existing) throw new NotFoundException('Task not found');

    // Mimic Pydantic's `exclude_unset=True`: only keys actually present on
    // the validated body get applied. class-validator with `whitelist: true`
    // strips unknown keys; the DTO fields left undefined mean "not sent".
    const present = new Set(Object.keys(raw) as (keyof TaskUpdateDto)[]);

    if (
      present.has('parent_id') &&
      raw.parent_id !== null &&
      raw.parent_id !== undefined &&
      raw.parent_id !== existing.parent_id
    ) {
      await this.checkCircularParent(id, raw.parent_id);
    }

    const updates: Prisma.TaskUpdateInput = { updated_at: new Date() };

    if (present.has('title') && raw.title !== undefined) updates.title = raw.title;
    if (present.has('description')) updates.description = raw.description ?? null;
    if (present.has('color') && raw.color !== null && raw.color !== undefined) {
      updates.color = raw.color;
    }
    if (present.has('priority') && raw.priority) {
      updates.priority = PRIORITY_TO_PRISMA[raw.priority];
    }
    if (present.has('scheduled_start')) {
      updates.scheduled_start = this.parseDate(raw.scheduled_start) ?? null;
    }
    if (present.has('scheduled_end')) {
      updates.scheduled_end = this.parseDate(raw.scheduled_end) ?? null;
    }
    if (present.has('deadline')) {
      updates.deadline = this.parseDate(raw.deadline) ?? null;
    }
    if (present.has('board_id')) {
      updates.boards =
        raw.board_id == null ? { disconnect: true } : { connect: { id: raw.board_id } };
    }
    if (present.has('parent_id')) {
      updates.parent =
        raw.parent_id == null ? { disconnect: true } : { connect: { id: raw.parent_id } };
    }
    if (present.has('tg_remind')) updates.tg_remind = raw.tg_remind ?? false;
    if (present.has('tg_remind_at')) {
      updates.tg_remind_at = this.parseDate(raw.tg_remind_at) ?? null;
    }
    if (present.has('my_day')) updates.my_day = raw.my_day ?? false;

    if (present.has('repeat_days')) {
      // Python: `task.repeat_days = value if value else None` — so `[]`
      // and `null` both collapse. Prisma's Int[] can't store NULL, so `[]`
      // is as close as we get; serializer maps it back to `null` on read.
      const val = raw.repeat_days;
      const next = val && val.length > 0 ? val : [];
      updates.repeat_days = { set: next };
    }

    let newStatus: KanbanStatus | undefined;
    if (present.has('status') && raw.status) {
      newStatus = KANBAN_TO_PRISMA[raw.status];
      updates.status = newStatus;
      // completed_at transitions, mirroring tasks.py line 328-332. Python
      // stamps now only if `completed_at IS NULL` at the time of the PATCH
      // (i.e. preserves existing DONE timestamps; a re-DONE doesn't reset).
      if (newStatus === 'DONE' && existing.completed_at === null) {
        updates.completed_at = new Date();
      } else if (newStatus !== 'DONE') {
        updates.completed_at = null;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: updates });
      if (present.has('tag_ids') && raw.tag_ids !== undefined) {
        await this.replaceTags(tx, id, userId, raw.tag_ids);
      }
    });

    return this.get(userId, id);
  }

  // ─── Kanban reorder ─────────────────────────────────────────────────────

  async reorder(userId: number, data: KanbanReorderDto): Promise<{ ok: true }> {
    if (!data.ordered_ids || data.ordered_ids.length === 0) {
      return { ok: true };
    }
    const status = KANBAN_TO_PRISMA[data.status];
    const now = new Date();

    // Two-pass for DONE: pre-fetch which ids already carry a
    // `completed_at`, then stamp the rest with `now`. This preserves the
    // "when the user first moved it to DONE" timestamp across re-orderings
    // inside the DONE column (tasks.py lines 275-285). `updateMany` can't
    // per-row branch, so we do N parallel updates — small N (≤ a column's
    // worth of tasks), so the cost is fine.
    await this.prisma.$transaction(async (tx) => {
      // Scope the whole operation to this user: any id the caller doesn't
      // own silently no-ops (the `updateMany` WHERE excludes it). Matches
      // Python's `Task.user_id == current_user.id` guard.
      const owned = await tx.task.findMany({
        where: { id: { in: data.ordered_ids }, user_id: userId },
        select: { id: true, completed_at: true },
      });
      const ownedMap = new Map(owned.map((t) => [t.id, t]));

      await Promise.all(
        data.ordered_ids.map((id, idx) => {
          if (!ownedMap.has(id)) return Promise.resolve();
          const row = ownedMap.get(id)!;
          const updates: Prisma.TaskUpdateInput = {
            status,
            kanban_order: idx,
            updated_at: now,
          };
          if (status === 'DONE') {
            if (row.completed_at === null) {
              updates.completed_at = now;
            }
            // else: preserve existing timestamp
          } else {
            updates.completed_at = null;
          }
          return tx.task.update({ where: { id }, data: updates });
        }),
      );
    });

    return { ok: true };
  }

  // ─── Archive / unarchive / delete ──────────────────────────────────────

  async archive(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.task.findFirst({
      where: { id, user_id: userId },
      select: { id: true, completed_at: true },
    });
    if (!existing) throw new NotFoundException('Task not found');
    const updates: Prisma.TaskUpdateInput = { is_archived: true, updated_at: new Date() };
    if (existing.completed_at === null) {
      updates.completed_at = new Date();
    }
    await this.prisma.task.update({ where: { id }, data: updates });
  }

  async unarchive(userId: number, id: number): Promise<TaskResponseDto> {
    const existing = await this.prisma.task.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Task not found');
    await this.prisma.task.update({
      where: { id },
      data: { is_archived: false, updated_at: new Date() },
    });
    return this.get(userId, id);
  }

  async delete(userId: number, id: number, permanent: boolean): Promise<void> {
    const existing = await this.prisma.task.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Task not found');

    if (permanent) {
      // DB FK `ON DELETE CASCADE` removes subtasks + `task_tags`.
      await this.prisma.task.delete({ where: { id } });
      return;
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id },
        data: { deleted_at: now, updated_at: now },
      }),
      // Soft-delete propagates to direct subtasks only. Python's router
      // also only walks one level (tasks.py lines 400-405); deeper nesting
      // isn't currently used by the UI.
      this.prisma.task.updateMany({
        where: { parent_id: id, user_id: userId, deleted_at: null },
        data: { deleted_at: now, updated_at: now },
      }),
    ]);
  }
}
