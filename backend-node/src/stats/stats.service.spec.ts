import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from './stats.service';

/**
 * Unit-level assertions with Prisma fully mocked. We can't hit the real
 * GROUP BY queries here, so this spec verifies the wrapper math: window
 * selection, rounding, most-active-hours top-4 by count, streak
 * walk-back. Integration parity with Python is left to the e2e.
 */
describe('StatsService', () => {
  let service: StatsService;
  let prisma: {
    task: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    habit: { findMany: jest.Mock };
    habitLog: { findMany: jest.Mock; count: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      task: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      habit: { findMany: jest.fn().mockResolvedValue([]) },
      habitLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [StatsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(StatsService);
  });

  it('returns zeroed shape when the DB is empty', async () => {
    const out = await service.getStats(1, { periodDays: 7 });
    expect(out.active_tasks).toBe(0);
    expect(out.completed_last_month).toBe(0);
    expect(out.overdue_count).toBe(0);
    expect(out.avg_completion_hours).toBeNull();
    expect(out.productivity_percent).toBeNull();
    expect(out.most_active_hours).toEqual([]);
    expect(out.habit_progress).toEqual([]);
    expect(out.daily_completions).toEqual([]);
    expect(out.by_priority).toEqual([]);
    expect(out.by_board).toEqual([]);
    expect(out.by_tag).toEqual([]);
    expect(out.week_start).toBeNull();
    expect(out.previous_period_metrics).toBeNull();
  });

  it('most_active_hours returns at most 4, sorted desc by count', async () => {
    // Counts per hour: 9→1, 10→4, 11→2, 12→3, 13→5, 14→1 → top4 = [13,10,12,11]
    const mk = (h: number): { completed_at: Date } => ({
      completed_at: new Date(Date.UTC(2026, 3, 20, h, 0, 0)),
    });
    const rows = [
      mk(9),
      mk(10),
      mk(10),
      mk(10),
      mk(10),
      mk(11),
      mk(11),
      mk(12),
      mk(12),
      mk(12),
      mk(13),
      mk(13),
      mk(13),
      mk(13),
      mk(13),
      mk(14),
    ];
    prisma.task.findMany.mockImplementation(({ select }: { select?: unknown }) =>
      Promise.resolve(select ? rows : []),
    );
    const out = await service.getStats(1, { periodDays: 30 });
    expect(out.most_active_hours).toEqual([13, 10, 12, 11]);
  });

  it('productivity_percent rounds to 1 decimal', async () => {
    // Completed = 3, created = 7 → 3/7 = 42.857% → 42.9
    prisma.task.count
      .mockResolvedValueOnce(0) // active
      .mockResolvedValueOnce(3) // completed_last_month
      .mockResolvedValueOnce(0) // overdue
      .mockResolvedValueOnce(7); // total_created
    const out = await service.getStats(1, { periodDays: 7 });
    expect(out.productivity_percent).toBe(42.9);
  });

  it('week_start mode triggers previous_period_metrics block', async () => {
    prisma.task.count.mockResolvedValue(0);
    const out = await service.getStats(1, { weekStart: '2026-04-13' });
    expect(out.week_start).toBe('2026-04-13');
    expect(out.previous_period_metrics).toEqual({
      completed_count: 0,
      productivity_percent: null,
      active_days: 0,
      habits_done_pct: null,
    });
  });

  it('habit streak walks back consecutive days from today', async () => {
    prisma.habit.findMany.mockResolvedValueOnce([
      { id: 11, name: 'Read', color: '#000000', is_active: true, user_id: 1 },
    ]);
    const today = new Date();
    const ymdOf = (d: Date): string => d.toISOString().slice(0, 10);
    const todayYmd = ymdOf(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
    );
    // Three days in a row ending today.
    const dates = [0, 1, 2].map(
      (off) => new Date(new Date(`${todayYmd}T00:00:00.000Z`).getTime() - off * 86400_000),
    );
    // First call: window logs. Second call: 365-day streak logs.
    prisma.habitLog.findMany
      .mockResolvedValueOnce(dates.map((d) => ({ date: d })))
      .mockResolvedValueOnce(dates.map((d) => ({ date: d })));
    const out = await service.getStats(1, { periodDays: 7 });
    expect(out.habit_progress).toHaveLength(1);
    expect(out.habit_progress[0].current_streak).toBe(3);
  });
});
