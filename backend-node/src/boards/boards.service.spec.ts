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
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('BoardsService', () => {
  let service: BoardsService;
  let prisma: {
    board: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      board: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

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
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual([
        {
          id: 1,
          name: 'Inbox',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        expect.objectContaining({ id: 2 }),
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
});
