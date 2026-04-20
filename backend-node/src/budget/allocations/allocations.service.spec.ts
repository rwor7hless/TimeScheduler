import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AllocationsService } from './allocations.service';

function makePrisma(): PrismaService {
  return {
    budgetAllocation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe('AllocationsService', () => {
  it('upsert calls Prisma upsert on the unique composite key', async () => {
    const prisma = makePrisma();
    const now = new Date('2026-03-01T00:00:00Z');
    (prisma.budgetAllocation.upsert as jest.Mock).mockResolvedValue({
      id: 9,
      year: 2026,
      month: 3,
      category: 'food',
      limit_amount: 500,
      created_at: now,
    });
    const svc = new AllocationsService(prisma);
    const out = await svc.upsert(7, {
      year: 2026,
      month: 3,
      category: 'food',
      limit_amount: 500,
    });
    expect(prisma.budgetAllocation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id_year_month_category: {
            user_id: 7,
            year: 2026,
            month: 3,
            category: 'food',
          },
        },
        update: { limit_amount: 500 },
      }),
    );
    expect(out).toMatchObject({ id: 9, limit_amount: 500, created_at: now.toISOString() });
  });

  it('delete throws NotFound on cross-user access', async () => {
    const prisma = makePrisma();
    (prisma.budgetAllocation.findFirst as jest.Mock).mockResolvedValue(null);
    const svc = new AllocationsService(prisma);
    await expect(svc.delete(1, 99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
