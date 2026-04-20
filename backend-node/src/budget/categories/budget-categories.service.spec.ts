import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BudgetCategoriesService, DEFAULT_CATS, slugify } from './budget-categories.service';

function makePrisma(): PrismaService {
  return {
    budgetCategory: {
      count: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe('BudgetCategoriesService', () => {
  it('slugify handles unicode labels', () => {
    expect(slugify('Еда')).toBe('еда');
    expect(slugify('  Hello,  World  ')).toBe('hello-world');
    expect(slugify('***')).toBe('cat');
    expect(slugify('a'.repeat(60))).toHaveLength(50);
  });

  it('DEFAULT_CATS has exactly 11 entries matching Python order', () => {
    expect(DEFAULT_CATS).toHaveLength(11);
    expect(DEFAULT_CATS[0]).toEqual(expect.objectContaining({ key: 'food', sort_order: 0 }));
    expect(DEFAULT_CATS.at(-1)).toEqual(expect.objectContaining({ key: 'other', sort_order: 10 }));
  });

  it('ensureDefaults inserts 11 rows when count is 0', async () => {
    const prisma = makePrisma();
    (prisma.budgetCategory.count as jest.Mock).mockResolvedValue(0);
    (prisma.budgetCategory.createMany as jest.Mock).mockResolvedValue({ count: 11 });
    const svc = new BudgetCategoriesService(prisma);
    await svc.ensureDefaults(7);
    expect(prisma.budgetCategory.count).toHaveBeenCalledWith({ where: { user_id: 7 } });
    const createArg = (prisma.budgetCategory.createMany as jest.Mock).mock.calls[0][0];
    expect(createArg.data).toHaveLength(11);
    expect(createArg.skipDuplicates).toBe(true);
  });

  it('ensureDefaults is a no-op when user already has categories', async () => {
    const prisma = makePrisma();
    (prisma.budgetCategory.count as jest.Mock).mockResolvedValue(5);
    const svc = new BudgetCategoriesService(prisma);
    await svc.ensureDefaults(7);
    expect(prisma.budgetCategory.createMany).not.toHaveBeenCalled();
  });

  it('ensureDefaults swallows P2002 race', async () => {
    const prisma = makePrisma();
    (prisma.budgetCategory.count as jest.Mock).mockResolvedValue(0);
    const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '5',
    });
    (prisma.budgetCategory.createMany as jest.Mock).mockRejectedValue(p2002);
    const svc = new BudgetCategoriesService(prisma);
    await expect(svc.ensureDefaults(7)).resolves.toBeUndefined();
  });

  it('create rejects duplicate key', async () => {
    const prisma = makePrisma();
    (prisma.budgetCategory.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
    const svc = new BudgetCategoriesService(prisma);
    await expect(svc.create(1, { label: 'X', key: 'food' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
