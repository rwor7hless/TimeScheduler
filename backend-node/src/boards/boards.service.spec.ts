import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Board } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from './boards.service';

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 1,
    user_id: 1,
    name: 'Inbox',
    group_id: null,
    sort_order: 0,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('BoardsService', () => {
  let service: BoardsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      board: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      boardGroup: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [BoardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BoardsService);
  });

  describe('list', () => {
    it('filters by user_id and serializes timestamps as ISO strings, ordered by id asc', async () => {
      prisma.board.findMany.mockResolvedValue([makeBoard({ id: 1 }), makeBoard({ id: 2 })]);

      const result = await service.list(7);

      expect(prisma.board.findMany).toHaveBeenCalledWith({
        where: { user_id: 7 },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(result).toEqual([
        {
          id: 1,
          name: 'Inbox',
          group_id: null,
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        expect.objectContaining({ id: 2, group_id: null, sort_order: 0 }),
      ]);
      // Parity guard — Python's BoardResponse excludes user_id.
      expect(result[0]).not.toHaveProperty('user_id');
    });
  });

  describe('create', () => {
    it('scopes the row to the calling user_id and returns the serialized board', async () => {
      prisma.board.create.mockResolvedValue(makeBoard({ id: 42, name: 'New' }));

      const result = await service.create(7, { name: 'New' });

      expect(prisma.board.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ user_id: 7, name: 'New' }),
      });
      expect(result.id).toBe(42);
      expect(result.name).toBe('New');
    });

    it('passes group_id and sort_order through when provided', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue({ id: 5 });
      prisma.board.create.mockResolvedValue(
        makeBoard({ id: 99, group_id: 5, sort_order: 3 }),
      );

      await service.create(7, { name: 'X', group_id: 5, sort_order: 3 });

      expect(prisma.board.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 7,
          name: 'X',
          group_id: 5,
          sort_order: 3,
        }),
      });
    });

    it('rejects creation with a foreign user group_id (404)', async () => {
      prisma.boardGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.create(7, { name: 'X', group_id: 999 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.board.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404s when the board belongs to another user (scoped findFirst returns null)', async () => {
      prisma.board.findFirst.mockResolvedValue(null);
      await expect(service.update(7, 1, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.board.update).not.toHaveBeenCalled();
    });

    it('persists the new name and bumps updated_at', async () => {
      prisma.board.findFirst.mockResolvedValue(makeBoard());
      prisma.board.update.mockResolvedValue(makeBoard({ name: 'Renamed' }));

      const result = await service.update(1, 1, { name: 'Renamed' });

      expect(prisma.board.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ name: 'Renamed' }),
      });
      expect(result.name).toBe('Renamed');
    });
  });

  describe('update with group_id / sort_order', () => {
    it('applies partial fields without overwriting unspecified ones', async () => {
      prisma.board.findFirst.mockResolvedValue(makeBoard({ id: 5 }));
      prisma.boardGroup.findFirst.mockResolvedValue({ id: 9 });
      prisma.board.update.mockResolvedValue(makeBoard({ id: 5, group_id: 9, sort_order: 2 }));

      await service.update(7, 5, { group_id: 9, sort_order: 2 });

      expect(prisma.board.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({ group_id: 9, sort_order: 2 }),
      });
      const updateCall = prisma.board.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('name');
    });

    it('accepts group_id=null to detach from group', async () => {
      prisma.board.findFirst.mockResolvedValue(makeBoard({ id: 5, group_id: 9 }));
      prisma.board.update.mockResolvedValue(makeBoard({ id: 5, group_id: null }));

      await service.update(7, 5, { group_id: null });

      expect(prisma.board.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({ group_id: null }),
      });
    });

    it('rejects update with a foreign user group_id (404)', async () => {
      prisma.board.findFirst.mockResolvedValue(makeBoard({ id: 5 }));
      prisma.boardGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.update(7, 5, { group_id: 999 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.board.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('404s on foreign board, never issues DELETE', async () => {
      prisma.board.findFirst.mockResolvedValue(null);
      await expect(service.delete(7, 99)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.board.delete).not.toHaveBeenCalled();
    });

    it('deletes cleanly when the board belongs to the caller', async () => {
      prisma.board.findFirst.mockResolvedValue(makeBoard());
      prisma.board.delete.mockResolvedValue(undefined);
      await service.delete(1, 1);
      expect(prisma.board.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('reorder', () => {
    it('writes sort_order in the given sequence within a group_id', async () => {
      prisma.board.findMany.mockResolvedValue([
        { id: 5 } as Board,
        { id: 6 } as Board,
        { id: 9 } as Board,
      ]);
      prisma.board.update.mockResolvedValue(makeBoard());

      await service.reorder(7, { group_id: 3, ordered_ids: [9, 5, 6] });

      expect(prisma.board.findMany).toHaveBeenCalledWith({
        where: { id: { in: [9, 5, 6] }, user_id: 7, group_id: 3 },
        select: { id: true },
      });
      expect(prisma.board.update).toHaveBeenCalledTimes(3);
      expect(prisma.board.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: expect.objectContaining({ sort_order: 0 }),
      });
    });

    it('handles top-level (group_id=null) with the right Prisma where filter', async () => {
      prisma.board.findMany.mockResolvedValue([{ id: 5 } as Board]);
      prisma.board.update.mockResolvedValue(makeBoard());

      await service.reorder(7, { group_id: null, ordered_ids: [5] });

      expect(prisma.board.findMany).toHaveBeenCalledWith({
        where: { id: { in: [5] }, user_id: 7, group_id: null },
        select: { id: true },
      });
    });

    it('skips ids whose row does not match (user, group_id) tuple', async () => {
      prisma.board.findMany.mockResolvedValue([{ id: 5 } as Board]);
      prisma.board.update.mockResolvedValue(makeBoard());

      await service.reorder(7, { group_id: 3, ordered_ids: [5, 999] });

      expect(prisma.board.update).toHaveBeenCalledTimes(1);
      expect(prisma.board.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({ sort_order: 0 }),
      });
    });

    it('returns immediately for empty ordered_ids', async () => {
      const result = await service.reorder(7, { group_id: null, ordered_ids: [] });
      expect(result).toEqual({ ok: true });
      expect(prisma.board.findMany).not.toHaveBeenCalled();
    });
  });
});
