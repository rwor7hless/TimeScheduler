import { PrismaService } from '../prisma/prisma.service';
import { WeeklyDataService } from './weekly-data.service';

function makePrisma(): PrismaService {
  return {
    board: { findMany: jest.fn() },
    task: { findMany: jest.fn(), count: jest.fn() },
    habit: { findMany: jest.fn() },
    habitLog: { count: jest.fn() },
  } as unknown as PrismaService;
}

describe('WeeklyDataService', () => {
  it('mondayOfToday returns a Monday', () => {
    const svc = new WeeklyDataService(makePrisma());
    const m = svc.mondayOfToday();
    // JS: Sunday=0, Monday=1 → we want UTC Monday = 1
    expect(m.getUTCDay()).toBe(1);
  });

  it('buildWeeklyData combines project + habit + budget stub', async () => {
    const prisma = makePrisma();
    (prisma.board.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: 'Work' }]);
    (prisma.task.findMany as jest.Mock).mockImplementation(
      ({ where }: { where: { status: unknown; board_id: number | null } }) => {
        if (where.board_id === 1 && where.status === 'DONE') {
          return Promise.resolve([{ id: 10, title: 'Написать', priority: 'HIGH', deadline: null }]);
        }
        return Promise.resolve([]);
      },
    );
    (prisma.task.count as jest.Mock).mockResolvedValue(0);
    (prisma.habit.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: 'бег' }]);
    (prisma.habitLog.count as jest.Mock).mockResolvedValue(5);

    const svc = new WeeklyDataService(prisma);
    const data = await svc.buildWeeklyData(1, new Date('2026-04-13T00:00:00.000Z'));

    expect(data.week_start).toBe('13.04.2026');
    expect(data.week_end).toBe('19.04.2026');
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe('Work');
    expect(data.projects[0].done_tasks).toHaveLength(1);
    expect(data.projects[0].done_tasks[0].priority).toBe('высокий');
    expect(data.habits).toEqual([{ name: 'бег', done_days: 5 }]);
    expect(data.budget).toEqual({
      total_expense: 0,
      total_income: 0,
      top_categories: [],
      avg_per_week: 0,
      delta_pct: null,
      planned_done: 0,
      planned_total: 0,
      overspent: [],
    });
  });

  it('skips fully-empty projects', async () => {
    const prisma = makePrisma();
    (prisma.board.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Empty' },
      { id: 2, name: 'Busy' },
    ]);
    (prisma.task.findMany as jest.Mock).mockImplementation(
      ({ where }: { where: { board_id: number | null; status: unknown } }) => {
        if (where.board_id === 2 && where.status === 'DONE') {
          return Promise.resolve([{ id: 1, title: 't', priority: 'LOW', deadline: null }]);
        }
        return Promise.resolve([]);
      },
    );
    (prisma.task.count as jest.Mock).mockResolvedValue(0);
    (prisma.habit.findMany as jest.Mock).mockResolvedValue([]);

    const svc = new WeeklyDataService(prisma);
    const data = await svc.buildWeeklyData(1, new Date('2026-04-13T00:00:00.000Z'));
    expect(data.projects.map((p) => p.name)).toEqual(['Busy']);
  });
});
