import { ConfigService } from '@nestjs/config';
import { TasksCleanupService } from './tasks-cleanup.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('TasksCleanupService', () => {
  // Fixed reference moment: cron fires at 2026-04-30 00:00 Europe/Moscow.
  // In UTC that's 2026-04-29 21:00. Yesterday window (Moscow):
  //   [2026-04-29 00:00 MSK, 2026-04-30 00:00 MSK)
  //   = [2026-04-28 21:00 UTC, 2026-04-29 21:00 UTC)
  const NOW_UTC = new Date('2026-04-29T21:00:00.000Z');
  // yesterdayStart (UTC) = 2026-04-28T21:00; getUTCDay → 2 (Tue),
  // (2 + 6) % 7 = 1 → in our 0=Mon..6=Sun convention "yesterday" is Tuesday.
  // (Не путать с "yesterday в Moscow TZ" — для теста важна только согласованность
  //  с тем, как сервис вычисляет yesterdayDow.)
  const YESTERDAY_DOW_MON_BASED = 1;

  function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
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

  function setup(candidates: ReturnType<typeof makeTask>[]) {
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
    const myDayCall = updateMany.mock.calls.find(
      (c) => (c[0] as { data: { my_day?: boolean } }).data.my_day === false,
    );
    expect(myDayCall).toBeDefined();
    expect((myDayCall![0] as { where: { id: { in: number[] } } }).where.id.in).toContain(16);
    // scheduled_start clear should NOT include id=16 (deadline branch suppresses it).
    const schedCall = updateMany.mock.calls.find(
      (c) =>
        (c[0] as { data: { scheduled_start?: null } }).data.scheduled_start === null,
    );
    expect((schedCall![0] as { where: { id: { in: number[] } } }).where.id.in).not.toContain(16);
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
