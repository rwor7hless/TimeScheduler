import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BoardGroup } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardGroupsService } from './board-groups.service';

function makeGroup(overrides: Partial<BoardGroup> = {}): BoardGroup {
  return {
    id: 1,
    user_id: 1,
    name: 'Group',
    sort_order: 0,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('BoardGroupsService', () => {
  let service: BoardGroupsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      boardGroup: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      board: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      task: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [BoardGroupsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BoardGroupsService);
  });

  describe('list', () => {
    it('filters by user_id and orders by sort_order asc, id asc', async () => {
      prisma.boardGroup.findMany.mockResolvedValue([makeGroup({ id: 2 }), makeGroup({ id: 5 })]);

      const result = await service.list(7);

      expect(prisma.boardGroup.findMany).toHaveBeenCalledWith({
        where: { user_id: 7 },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(result).toEqual([
        expect.objectContaining({ id: 2, sort_order: 0, created_at: expect.any(String) }),
        expect.objectContaining({ id: 5 }),
      ]);
      expect(result[0]).not.toHaveProperty('user_id');
    });
  });

  describe('create', () => {
    it('scopes to userId and returns serialized group', async () => {
      prisma.boardGroup.create.mockResolvedValue(makeGroup({ id: 42, name: 'Веселo' }));

      const result = await service.create(7, { name: 'Веселo' });

      expect(prisma.boardGroup.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ user_id: 7, name: 'Веселo', sort_order: 0 }),
      });
      expect(result).toEqual(expect.objectContaining({ id: 42, name: 'Веселo' }));
    });
  });

  describe('update', () => {
    it('renames an owned group', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue(makeGroup({ id: 5 }));
      prisma.boardGroup.update.mockResolvedValue(makeGroup({ id: 5, name: 'Renamed' }));

      const result = await service.update(7, 5, { name: 'Renamed' });

      expect(prisma.boardGroup.findFirst).toHaveBeenCalledWith({
        where: { id: 5, user_id: 7 },
      });
      expect(prisma.boardGroup.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({ name: 'Renamed' }),
      });
      expect(result.name).toBe('Renamed');
    });

    it('skips name in patch when name is undefined (no-op rename)', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue(makeGroup({ id: 5, name: 'Stable' }));
      prisma.boardGroup.update.mockResolvedValue(makeGroup({ id: 5, name: 'Stable' }));

      await service.update(7, 5, {});

      const updateCall = prisma.boardGroup.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('name');
      expect(updateCall.data).toHaveProperty('updated_at');
    });

    it('throws NotFound when the group belongs to another user', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue(null);

      await expect(service.update(7, 5, { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.boardGroup.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('cascade=false: deletes only the group; FK SET NULL detaches boards', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue(makeGroup({ id: 5 }));

      await service.delete(7, 5, false);

      expect(prisma.board.deleteMany).not.toHaveBeenCalled();
      expect(prisma.boardGroup.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('cascade=true: deletes tasks → boards → group atomically', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue(makeGroup({ id: 5 }));
      prisma.board.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }]);

      await service.delete(7, 5, true);

      expect(prisma.board.findMany).toHaveBeenCalledWith({
        where: { group_id: 5 },
        select: { id: true },
      });
      expect(prisma.task.deleteMany).toHaveBeenCalledWith({
        where: { board_id: { in: [11, 12] } },
      });
      expect(prisma.board.deleteMany).toHaveBeenCalledWith({ where: { group_id: 5 } });
      expect(prisma.boardGroup.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('throws NotFound for a foreign group', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue(null);
      await expect(service.delete(7, 5, false)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.boardGroup.delete).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('writes sort_order in the given sequence, scoped to the user', async () => {
      prisma.boardGroup.findMany.mockResolvedValue([
        { id: 5 },
        { id: 6 },
        { id: 9 },
      ]);
      prisma.boardGroup.update.mockResolvedValue(makeGroup());

      await service.reorder(7, { ordered_ids: [9, 5, 6] });

      expect(prisma.boardGroup.findMany).toHaveBeenCalledWith({
        where: { id: { in: [9, 5, 6] }, user_id: 7 },
        select: { id: true },
      });
      expect(prisma.boardGroup.update).toHaveBeenCalledTimes(3);
      expect(prisma.boardGroup.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { sort_order: 0, updated_at: expect.any(Date) },
      });
      expect(prisma.boardGroup.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { sort_order: 1, updated_at: expect.any(Date) },
      });
      expect(prisma.boardGroup.update).toHaveBeenCalledWith({
        where: { id: 6 },
        data: { sort_order: 2, updated_at: expect.any(Date) },
      });
    });

    it('silently skips ids not owned by the user', async () => {
      prisma.boardGroup.findMany.mockResolvedValue([{ id: 5 }]);
      prisma.boardGroup.update.mockResolvedValue(makeGroup());

      await service.reorder(7, { ordered_ids: [5, 999] });

      expect(prisma.boardGroup.update).toHaveBeenCalledTimes(1);
      expect(prisma.boardGroup.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({ sort_order: 0 }),
      });
    });

    it('returns immediately for empty ordered_ids', async () => {
      const result = await service.reorder(7, { ordered_ids: [] });
      expect(result).toEqual({ ok: true });
      expect(prisma.boardGroup.findMany).not.toHaveBeenCalled();
      expect(prisma.boardGroup.update).not.toHaveBeenCalled();
    });
  });
});
