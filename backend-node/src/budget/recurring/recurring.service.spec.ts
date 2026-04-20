import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecurringService } from './recurring.service';

function makePrisma(): PrismaService {
  return {
    recurringTransaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;
}

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  user_id: 1,
  type: 'expense',
  amount: 100,
  category: 'food',
  description: '',
  tag_ids: [],
  day_of_month: 15,
  start_date: '2026-01-01',
  end_date: null,
  last_generated_date: null,
  is_paused: false,
  created_at: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

describe('RecurringService', () => {
  it('rejects day_of_month = 0', async () => {
    const prisma = makePrisma();
    const svc = new RecurringService(prisma);
    await expect(
      svc.create(1, {
        type: 'expense',
        amount: 10,
        day_of_month: 0,
        start_date: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects day_of_month = 32', async () => {
    const prisma = makePrisma();
    const svc = new RecurringService(prisma);
    await expect(
      svc.create(1, {
        type: 'expense',
        amount: 10,
        day_of_month: 32,
        start_date: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts day_of_month = 31', async () => {
    const prisma = makePrisma();
    (prisma.recurringTransaction.create as jest.Mock).mockResolvedValue(row({ day_of_month: 31 }));
    const svc = new RecurringService(prisma);
    const out = await svc.create(1, {
      type: 'expense',
      amount: 10,
      day_of_month: 31,
      start_date: '2026-01-01',
    });
    expect(out.day_of_month).toBe(31);
  });

  it('update 404s on cross-user access', async () => {
    const prisma = makePrisma();
    (prisma.recurringTransaction.findFirst as jest.Mock).mockResolvedValue(null);
    const svc = new RecurringService(prisma);
    await expect(svc.update(1, 99, { amount: 200 })).rejects.toBeInstanceOf(NotFoundException);
  });
});
