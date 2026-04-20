import { PrismaService } from '../../prisma/prisma.service';
import { SummaryService } from './summary.service';

class FrozenSummaryService extends SummaryService {
  constructor(
    prisma: PrismaService,
    private readonly frozen: Date,
  ) {
    super(prisma);
  }
  protected now(): Date {
    return this.frozen;
  }
}

function makePrisma(): PrismaService {
  return {
    transaction: { findMany: jest.fn() },
    plannedPurchase: { findMany: jest.fn() },
    budgetAllocation: { findMany: jest.fn() },
  } as unknown as PrismaService;
}

const tx = (
  overrides: Partial<{ type: string; amount: number; category: string | null; date: string }>,
) => ({
  id: 0,
  user_id: 1,
  type: 'expense',
  amount: 0,
  category: null,
  description: '',
  date: '2026-03-01',
  created_at: new Date(),
  source_planned_id: null,
  ...overrides,
});

describe('SummaryService', () => {
  it('aggregates totals and sorts by_category (null LAST, desc by spent)', async () => {
    const prisma = makePrisma();
    (prisma.transaction.findMany as jest.Mock).mockImplementation(({ where }) => {
      // Called 3 times: window tx, prev-month sum (select amount), ...
      // The first call without `select` is the main window.
      if (where.type === 'expense' && where.date?.gte?.startsWith('2026-02')) {
        // Previous-month sum call (select: {amount}).
        return Promise.resolve([{ amount: 100 }]);
      }
      return Promise.resolve([
        tx({ type: 'income', amount: 1000, date: '2026-03-05' }),
        tx({ type: 'expense', amount: 200, category: 'food', date: '2026-03-01' }),
        tx({ type: 'expense', amount: 50, category: 'food', date: '2026-03-02' }),
        tx({ type: 'expense', amount: 75, category: null, date: '2026-03-03' }),
        tx({ type: 'expense', amount: 300, category: 'transport', date: '2026-03-04' }),
      ]);
    });
    (prisma.plannedPurchase.findMany as jest.Mock).mockResolvedValue([
      { done: false, amount: 400, category: 'transport' },
      { done: true, amount: 50, category: 'food' },
    ]);
    (prisma.budgetAllocation.findMany as jest.Mock).mockResolvedValue([
      { category: 'food', limit_amount: 500 },
      { category: 'transport', limit_amount: 1000 },
    ]);

    const svc = new FrozenSummaryService(prisma, new Date('2026-03-10T12:00:00Z'));
    const out = await svc.build(1, 2026, 2); // month0=2 → March

    expect(out.totals.income).toBe(1000);
    expect(out.totals.expense).toBe(625);
    expect(out.totals.balance).toBe(375);
    expect(out.totals.planned_pending).toBe(400);
    expect(out.totals.planned_done).toBe(50);

    // by_category: transport 300 spent > food 250 > (null) 75.
    // Nulls last.
    const cats = out.by_category.map((c) => c.category);
    expect(cats[cats.length - 1]).toBeNull();
    const nonNull = out.by_category.filter((c) => c.category !== null);
    // Descending by spent among non-null.
    for (let i = 1; i < nonNull.length; i++) {
      expect(nonNull[i - 1].spent).toBeGreaterThanOrEqual(nonNull[i].spent);
    }
    const food = out.by_category.find((c) => c.category === 'food')!;
    expect(food.spent).toBe(250);
    expect(food.pct).toBe(50); // 250/500*100

    // Trend
    expect(out.trend.prev_expense).toBe(100);
    expect(out.trend.delta_abs).toBe(525);
    expect(out.trend.delta_pct).toBe(525);

    // Projection: days_passed=10, days_total=31
    expect(out.projection.days_total).toBe(31);
    expect(out.projection.days_passed).toBe(10);
    expect(out.projection.days_left).toBe(21);

    // Daily: 31 entries
    expect(out.daily).toHaveLength(31);
  });

  it('delta_pct is null when prev_expense is 0', async () => {
    const prisma = makePrisma();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.plannedPurchase.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.budgetAllocation.findMany as jest.Mock).mockResolvedValue([]);
    const svc = new FrozenSummaryService(prisma, new Date('2026-03-15T00:00:00Z'));
    const out = await svc.build(1, 2026, 2);
    expect(out.trend.delta_pct).toBeNull();
  });
});
