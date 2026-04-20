import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlannedService } from './planned.service';

function makePrisma(): PrismaService {
  const tx = {
    transaction: { create: jest.fn() },
    plannedPurchase: { delete: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    plannedTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    budgetTag: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    budgetTag: { findMany: jest.fn().mockResolvedValue([]) },
    plannedPurchase: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    // expose inner tx for assertions
    _tx: tx,
  } as unknown as PrismaService;
}

describe('PlannedService.convert', () => {
  it('creates transaction and deletes the plan atomically', async () => {
    const prisma = makePrisma();
    const pp = {
      id: 42,
      user_id: 1,
      year: 2026,
      month: 3,
      amount: 500,
      category: 'food',
      description: 'groceries',
      done: false,
      created_at: new Date(),
      source_recurring_id: null,
      planned_tags: [{ tag_id: 7 }],
    };
    (prisma.plannedPurchase.findFirst as jest.Mock).mockResolvedValue(pp);
    const txClient = (
      prisma as unknown as {
        _tx: {
          transaction: { create: jest.Mock };
          plannedPurchase: { delete: jest.Mock };
        };
      }
    )._tx;
    txClient.transaction.create.mockResolvedValue({
      id: 100,
      user_id: 1,
      type: 'expense',
      amount: 500,
      category: 'food',
      description: 'groceries',
      date: '2026-04-21',
      created_at: new Date(),
      source_planned_id: 42,
      transaction_tags: [],
    });

    const svc = new PlannedService(prisma);
    const out = await svc.convert(1, 42, { date: '2026-04-21' });

    expect(out.id).toBe(100);
    expect(out.source_planned_id).toBe(42);
    expect(out.amount).toBe(500);
    expect(txClient.transaction.create).toHaveBeenCalledTimes(1);
    expect(txClient.plannedPurchase.delete).toHaveBeenCalledWith({ where: { id: 42 } });
  });

  it('404 if plan not found or not owned by user', async () => {
    const prisma = makePrisma();
    (prisma.plannedPurchase.findFirst as jest.Mock).mockResolvedValue(null);
    const svc = new PlannedService(prisma);
    await expect(svc.convert(1, 42, {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
