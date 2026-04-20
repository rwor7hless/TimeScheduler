import { PrismaService } from '../../prisma/prisma.service';
import { BudgetWeeklyService } from './budget-weekly.service';

function makePrisma(): PrismaService {
  return {
    transaction: { findMany: jest.fn() },
    plannedPurchase: { findMany: jest.fn() },
    budgetAllocation: { findMany: jest.fn() },
  } as unknown as PrismaService;
}

describe('BudgetWeeklyService', () => {
  it('aggregates expenses/income/top categories for the 7-day window', async () => {
    const prisma = makePrisma();
    const weekEnd = new Date(Date.UTC(2026, 3, 19)); // Sun
    (prisma.transaction.findMany as jest.Mock).mockImplementation(({ where }) => {
      // Window window: 2026-04-13..2026-04-19
      if (where.date?.gte === '2026-04-13' && !where.type) {
        return Promise.resolve([
          { type: 'expense', amount: 100, category: 'food' },
          { type: 'expense', amount: 300, category: 'food' },
          { type: 'expense', amount: 50, category: 'transport' },
          { type: 'income', amount: 1000, category: null },
        ]);
      }
      // Baseline (prev 4 weeks): returns select-style rows with amount.
      if (where.type === 'expense' && where.date?.gte === '2026-03-16') {
        return Promise.resolve([{ amount: 200 }, { amount: 200 }]);
      }
      // Month-to-week expenses.
      if (where.type === 'expense' && where.date?.gte === '2026-04-01') {
        return Promise.resolve([{ category: 'food', amount: 600 }]);
      }
      return Promise.resolve([]);
    });
    (prisma.plannedPurchase.findMany as jest.Mock).mockResolvedValue([
      { done: true },
      { done: false },
      { done: false },
    ]);
    (prisma.budgetAllocation.findMany as jest.Mock).mockResolvedValue([
      { category: 'food', limit_amount: 500 },
    ]);

    const svc = new BudgetWeeklyService(prisma);
    const out = await svc.buildWeeklyBlock(1, weekEnd);

    expect(out.total_expense).toBe(450);
    expect(out.total_income).toBe(1000);
    expect(out.top_categories[0]).toEqual(['food', 400]);
    expect(out.top_categories[1]).toEqual(['transport', 50]);
    expect(out.avg_per_week).toBe(100); // baseline 400 / 4
    expect(out.delta_pct).toBe(350); // (450-100)/100*100
    expect(out.planned_total).toBe(3);
    expect(out.planned_done).toBe(1);
    expect(out.overspent).toEqual([['food', 600, 500]]);
  });

  it('delta_pct null when baseline is 0', async () => {
    const prisma = makePrisma();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.plannedPurchase.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.budgetAllocation.findMany as jest.Mock).mockResolvedValue([]);
    const svc = new BudgetWeeklyService(prisma);
    const out = await svc.buildWeeklyBlock(1, new Date(Date.UTC(2026, 3, 19)));
    expect(out.avg_per_week).toBe(0);
    expect(out.delta_pct).toBeNull();
  });
});
