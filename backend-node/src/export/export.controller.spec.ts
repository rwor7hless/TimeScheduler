import { Response } from 'express';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { ExportController } from './export.controller';

function makeRes(): Response & {
  _body?: unknown;
  _headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    send: function (b: unknown): unknown {
      (this as unknown as { _body: unknown })._body = b;
      return this;
    },
    _headers: headers,
  } as unknown as Response & { _body?: unknown; _headers: Record<string, string> };
  return res;
}

describe('ExportController', () => {
  const user = { id: 1 } as User;
  let controller: ExportController;
  let prisma: { task: { findMany: jest.Mock } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stats: any;

  beforeEach(() => {
    prisma = { task: { findMany: jest.fn().mockResolvedValue([]) } };
    stats = {
      getStats: jest.fn().mockResolvedValue({
        active_tasks: 1,
        completed_last_month: 2,
        overdue_count: 3,
        avg_completion_hours: 4.5,
        productivity_percent: 50.5,
        most_active_hours: [9, 10],
        habit_progress: [],
        daily_completions: [],
        by_priority: [],
        by_board: [],
        by_tag: [],
        week_start: null,
        previous_period_metrics: null,
      }),
    };
    controller = new ExportController(prisma as unknown as PrismaService, stats as StatsService);
  });

  it('tasks JSON default sets Content-Disposition', async () => {
    const res = makeRes();
    await controller.exportTasks(user, res);
    expect(res._headers['Content-Disposition']).toBe('attachment; filename=tasks.json');
    expect(res._headers['Content-Type']).toBe('application/json');
  });

  it('tasks CSV escapes quoted values + includes header row', async () => {
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 1,
        title: 'has, comma and "quote"',
        description: null,
        priority: 'HIGH',
        done: true,
        board_id: null,
        scheduled_start: null,
        scheduled_end: null,
        deadline: null,
        repeat_days: [1, 2],
        completed_at: null,
        created_at: new Date('2026-04-13T12:00:00Z'),
        is_archived: false,
        task_tags: [{ tags: { name: 'work' } }],
      },
    ]);
    const res = makeRes();
    await controller.exportTasks(user, res, 'csv');
    expect(res._headers['Content-Type']).toBe('text/csv');
    const body = res._body as string;
    expect(body.startsWith('id,title,description,')).toBe(true);
    expect(body).toContain('"has, comma and ""quote"""');
  });

  it('stats JSON returns the StatsService payload', async () => {
    const res = makeRes();
    await controller.exportStats(user, res, 'json', 'week');
    expect(stats.getStats).toHaveBeenCalledWith(1, { periodDays: 7, weekStart: null });
    const body = JSON.parse(res._body as string);
    expect(body.active_tasks).toBe(1);
  });

  it('stats CSV flattens to 6 scalar columns', async () => {
    const res = makeRes();
    await controller.exportStats(user, res, 'csv');
    const body = res._body as string;
    expect(body.split('\r\n')[0]).toBe(
      'active_tasks,completed_last_month,overdue_count,avg_completion_hours,productivity_percent,most_active_hours',
    );
    expect(body.split('\r\n')[1]).toBe('1,2,3,4.5,50.5,"9, 10"');
  });
});
