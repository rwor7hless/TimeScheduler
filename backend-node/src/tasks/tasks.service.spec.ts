import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';
import { escapeLikePattern, TASK_COLOR_PALETTE } from './tasks.constants';

/**
 * Unit coverage for the Tasks service. Mocks PrismaService via `useValue`
 * so the full-schema client is never instantiated — only the methods we
 * hit are stubbed. `$transaction` is stubbed two ways: when called with a
 * callback (the typical `async (tx) => ...` flavor used by create/update/
 * patch/reorder/etc.), we invoke the callback with the same mock client;
 * when called with an array of PrismaPromise-ish objects (the soft-delete
 * path), we resolve all of them.
 */

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    user_id: 1,
    board_id: null,
    parent_id: null,
    title: 'T',
    description: null,
    priority: 'MEDIUM',
    status: 'TODO',
    kanban_order: 0,
    scheduled_start: null,
    scheduled_end: null,
    deadline: null,
    repeat_days: [],
    completed_at: null,
    is_archived: false,
    my_day: false,
    tg_remind: false,
    tg_remind_at: null,
    tg_reminded: false,
    deleted_at: null,
    color: '#3B82F6',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function withRelations(t: Task) {
  return { ...t, task_tags: [], subtasks: [] };
}

describe('TasksService', () => {
  let service: TasksService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      board: {
        findFirst: jest.fn(),
      },
      tag: {
        findMany: jest.fn(),
      },
      taskTag: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') return arg(prisma);
        if (Array.isArray(arg)) return Promise.all(arg);
        return arg;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TasksService);
  });

  describe('TASK_COLOR_PALETTE', () => {
    it('matches Python constant byte-for-byte', () => {
      expect(TASK_COLOR_PALETTE).toEqual([
        '#3B82F6',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#EC4899',
        '#06B6D4',
        '#84CC16',
        '#F97316',
        '#6366F1',
      ]);
    });
  });

  describe('escapeLikePattern', () => {
    it('escapes backslash then % and _ in that order', () => {
      expect(escapeLikePattern('foo')).toBe('foo');
      expect(escapeLikePattern('foo%bar')).toBe('foo\\%bar');
      expect(escapeLikePattern('foo_bar')).toBe('foo\\_bar');
      expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
      expect(escapeLikePattern('50%_x')).toBe('50\\%\\_x');
    });
  });

  describe('checkCircularParent', () => {
    it('throws when the proposed parent IS the current task (self-cycle)', async () => {
      prisma.task.findUnique.mockResolvedValue({ parent_id: null });
      // visited starts with [taskId=10]. parentId=10 triggers immediate hit.
      await expect(service.checkCircularParent(10, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when walking up the chain lands back on taskId', async () => {
      // 5 -> parent 4 -> parent 5 (cycle)
      prisma.task.findUnique.mockImplementation(({ where }: { where: { id: number } }) => {
        if (where.id === 4) return Promise.resolve({ parent_id: 5 });
        return Promise.resolve({ parent_id: null });
      });
      await expect(service.checkCircularParent(5, 4)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('passes when walking up terminates at a root (parent_id null)', async () => {
      prisma.task.findUnique.mockResolvedValue({ parent_id: null });
      await expect(service.checkCircularParent(1, 2)).resolves.toBeUndefined();
    });
  });

  describe('list filters', () => {
    beforeEach(() => {
      prisma.task.findMany.mockResolvedValue([]);
    });

    it('applies default where: user scope + not archived + not deleted + top-level only', async () => {
      await service.list(7, {});
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 7,
            is_archived: false,
            deleted_at: null,
            parent_id: null,
          }),
          orderBy: { kanban_order: 'asc' },
        }),
      );
    });

    it('include_subtasks=true drops the parent_id null filter', async () => {
      await service.list(7, { include_subtasks: true });
      const call = prisma.task.findMany.mock.calls[0][0];
      expect(call.where.parent_id).toBeUndefined();
    });

    it('search escapes % and _ and uses insensitive contains on title', async () => {
      await service.list(7, { search: 'foo%bar' });
      const call = prisma.task.findMany.mock.calls[0][0];
      expect(call.where.title).toEqual({ contains: 'foo\\%bar', mode: 'insensitive' });
    });

    it('tag filter joins task_tags -> tags by name and user_id', async () => {
      await service.list(7, { tag: 'work' });
      const call = prisma.task.findMany.mock.calls[0][0];
      expect(call.where.task_tags).toEqual({
        some: { tags: { name: 'work', user_id: 7 } },
      });
    });

    it('default_board=true forces board_id NULL (overrides any board_id)', async () => {
      await service.list(7, { default_board: true, board_id: 99 });
      const call = prisma.task.findMany.mock.calls[0][0];
      expect(call.where.board_id).toBeNull();
    });
  });

  describe('create', () => {
    it('picks a random color from the palette when caller omits one', async () => {
      prisma.task.findFirst.mockResolvedValue(null); // max-order query
      prisma.task.create.mockResolvedValue({ id: 99 });
      prisma.task.findFirst.mockImplementation(() => Promise.resolve(null));
      prisma.task.findFirst.mockResolvedValueOnce(null); // max-order
      // second findFirst call happens inside get() → null → NotFound. We
      // want create() to pass; stub the get() reload instead via findFirst
      // returning a task on the second call.
      prisma.task.findFirst
        .mockReset()
        .mockResolvedValueOnce(null) // max_order lookup
        .mockResolvedValueOnce(withRelations(makeTask({ id: 99 })) as unknown as Task); // get() reload

      const result = await service.create(1, { title: 'X' });

      expect(prisma.task.create).toHaveBeenCalled();
      const createArg = prisma.task.create.mock.calls[0][0];
      expect(TASK_COLOR_PALETTE).toContain(createArg.data.color);
      expect(createArg.data.kanban_order).toBe(1); // max (null) + 1
      expect(result.id).toBe(99);
    });

    it('404s when board_id points to a foreign board', async () => {
      prisma.board.findFirst.mockResolvedValue(null);
      await expect(service.create(1, { title: 'X', board_id: 42 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404s when parent_id points to a foreign or missing task', async () => {
      // No board_id passed, so board check is skipped. parent findFirst returns null.
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.create(1, { title: 'X', parent_id: 77 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('assigns tags by replacing the TaskTag join set', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce({ id: 77 }) // parent lookup
        .mockResolvedValueOnce(null) // max-order
        .mockResolvedValueOnce(withRelations(makeTask({ id: 1 })) as unknown as Task); // get reload
      prisma.task.create.mockResolvedValue({ id: 1 });
      prisma.tag.findMany.mockResolvedValue([{ id: 10 }, { id: 20 }]);

      await service.create(1, { title: 'X', parent_id: 77, tag_ids: [10, 20, 30] });

      expect(prisma.taskTag.deleteMany).toHaveBeenCalledWith({ where: { task_id: 1 } });
      expect(prisma.taskTag.createMany).toHaveBeenCalledWith({
        data: [
          { task_id: 1, tag_id: 10 },
          { task_id: 1, tag_id: 20 },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('patch completed_at rules', () => {
    it('stamps completed_at when moving a non-done task to done (completed_at was null)', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce({ id: 1, parent_id: null, status: 'TODO', completed_at: null })
        .mockResolvedValueOnce(withRelations(makeTask()) as unknown as Task);
      prisma.task.update.mockResolvedValue({});

      await service.patch(1, 1, { status: 'done' });

      const updateArg = prisma.task.update.mock.calls[0][0];
      expect(updateArg.data.status).toBe('DONE');
      expect(updateArg.data.completed_at).toBeInstanceOf(Date);
    });

    it('preserves completed_at when patching a task that was already done', async () => {
      const originalDone = new Date('2026-01-10T12:00:00.000Z');
      prisma.task.findFirst
        .mockResolvedValueOnce({
          id: 1,
          parent_id: null,
          status: 'DONE',
          completed_at: originalDone,
        })
        .mockResolvedValueOnce(withRelations(makeTask()) as unknown as Task);
      prisma.task.update.mockResolvedValue({});

      await service.patch(1, 1, { status: 'done' });

      const updateArg = prisma.task.update.mock.calls[0][0];
      // Python's `if status == DONE and completed_at is None` branch — we
      // did NOT satisfy it, so completed_at must NOT be in the payload.
      expect(updateArg.data.completed_at).toBeUndefined();
    });

    it('clears completed_at when moving away from done', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce({
          id: 1,
          parent_id: null,
          status: 'DONE',
          completed_at: new Date(),
        })
        .mockResolvedValueOnce(withRelations(makeTask()) as unknown as Task);
      prisma.task.update.mockResolvedValue({});

      await service.patch(1, 1, { status: 'todo' });

      expect(prisma.task.update.mock.calls[0][0].data.completed_at).toBeNull();
    });
  });

  describe('reorder completed_at preservation', () => {
    it('preserves existing timestamps when moving DONE→DONE', async () => {
      const preexisting = new Date('2026-01-10T12:00:00.000Z');
      prisma.task.findMany.mockResolvedValue([
        { id: 1, completed_at: preexisting },
        { id: 2, completed_at: null },
      ]);
      prisma.task.update.mockResolvedValue({});

      await service.reorder(7, { status: 'done', ordered_ids: [2, 1] });

      const calls = prisma.task.update.mock.calls.map(
        (
          c: [
            { where: { id: number }; data: { completed_at?: Date | null; kanban_order: number } },
          ],
        ) => c[0],
      );
      const forId1 = calls.find((c: { where: { id: number } }) => c.where.id === 1);
      const forId2 = calls.find((c: { where: { id: number } }) => c.where.id === 2);
      // id=1 already had a completed_at → field omitted, preserving existing value.
      expect(forId1?.data.completed_at).toBeUndefined();
      // id=2 was null → stamped with current now().
      expect(forId2?.data.completed_at).toBeInstanceOf(Date);
      // kanban_order follows list position.
      expect(forId2?.data.kanban_order).toBe(0);
      expect(forId1?.data.kanban_order).toBe(1);
    });

    it('clears completed_at when moving to a non-DONE column', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 1, completed_at: new Date() },
        { id: 2, completed_at: null },
      ]);
      prisma.task.update.mockResolvedValue({});

      await service.reorder(7, { status: 'todo', ordered_ids: [1, 2] });

      for (const call of prisma.task.update.mock.calls) {
        expect(call[0].data.completed_at).toBeNull();
      }
    });

    it('no-ops on empty ordered_ids', async () => {
      const result = await service.reorder(7, { status: 'todo', ordered_ids: [] });
      expect(result).toEqual({ ok: true });
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });
  });

  describe('archive / unarchive / delete', () => {
    it('archive stamps completed_at if null; otherwise preserves', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 1, completed_at: null });
      prisma.task.update.mockResolvedValue({});
      await service.archive(1, 1);
      const upd = prisma.task.update.mock.calls[0][0];
      expect(upd.data.is_archived).toBe(true);
      expect(upd.data.completed_at).toBeInstanceOf(Date);
    });

    it('archive 404s on foreign task', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.archive(1, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('unarchive clears is_archived', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(withRelations(makeTask({ is_archived: false })) as unknown as Task);
      prisma.task.update.mockResolvedValue({});
      const result = await service.unarchive(1, 1);
      expect(prisma.task.update.mock.calls[0][0].data.is_archived).toBe(false);
      expect(result.is_archived).toBe(false);
    });

    it('soft-delete sets deleted_at on the task and direct subtasks', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 1 });
      prisma.task.update.mockResolvedValue({});
      prisma.task.updateMany.mockResolvedValue({ count: 2 });
      await service.delete(1, 1, false);
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { parent_id: 1, user_id: 1, deleted_at: null },
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      });
    });

    it('permanent delete issues hard DELETE (relies on FK cascade)', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 1 });
      prisma.task.delete.mockResolvedValue({});
      await service.delete(1, 1, true);
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('delete 404s on foreign task', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.delete(1, 1, false)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('serialize parity', () => {
    it('lowers Prisma UPPERCASE enums to Python wire format', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...makeTask({ status: 'IN_PROGRESS', priority: 'URGENT' }),
        task_tags: [],
        subtasks: [],
      });
      const result = await service.get(1, 1);
      expect(result.status).toBe('in_progress');
      expect(result.priority).toBe('urgent');
    });

    it('collapses empty repeat_days to null on the wire', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...makeTask({ repeat_days: [] }),
        task_tags: [],
        subtasks: [],
      });
      const result = await service.get(1, 1);
      expect(result.repeat_days).toBeNull();
    });

    it('preserves non-empty repeat_days as-is', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...makeTask({ repeat_days: [0, 2, 4] }),
        task_tags: [],
        subtasks: [],
      });
      const result = await service.get(1, 1);
      expect(result.repeat_days).toEqual([0, 2, 4]);
    });

    it('always includes subtasks array (never undefined)', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...makeTask(),
        task_tags: [],
        // subtasks missing from the select result
      });
      const result = await service.get(1, 1);
      expect(result.subtasks).toEqual([]);
    });
  });
});
