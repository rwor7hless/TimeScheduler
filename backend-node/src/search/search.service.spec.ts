import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: {
    task: { findMany: jest.Mock };
    habit: { findMany: jest.Mock };
    board: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      task: { findMany: jest.fn().mockResolvedValue([]) },
      habit: { findMany: jest.fn().mockResolvedValue([]) },
      board: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SearchService);
  });

  it('escapes LIKE wildcards before sending to Prisma', async () => {
    await service.search(1, '50% of\\one_');
    const taskArgs = prisma.task.findMany.mock.calls[0][0];
    expect(taskArgs.where.title.contains).toBe('50\\% of\\\\one\\_');
    expect(taskArgs.where.title.mode).toBe('insensitive');
  });

  it('scopes all three lists to the user', async () => {
    await service.search(42, 'foo');
    expect(prisma.task.findMany.mock.calls[0][0].where.user_id).toBe(42);
    expect(prisma.habit.findMany.mock.calls[0][0].where.user_id).toBe(42);
    expect(prisma.board.findMany.mock.calls[0][0].where.user_id).toBe(42);
  });

  it('excludes archived / subtasks / soft-deleted tasks', async () => {
    await service.search(1, 'x');
    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where.is_archived).toBe(false);
    expect(where.parent_id).toBeNull();
    expect(where.deleted_at).toBeNull();
  });

  it('serializes tasks with lowercased enums + type discriminator', async () => {
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Ship it',
        status: 'TODO',
        priority: 'HIGH',
        color: '#111111',
        board_id: 5,
        task_tags: [{ tags: { id: 9, name: 'work', color: '#222222' } }],
      },
    ]);
    const out = await service.search(1, 'ship');
    expect(out.tasks[0]).toEqual({
      id: 1,
      title: 'Ship it',
      status: 'todo',
      priority: 'high',
      color: '#111111',
      board_id: 5,
      tags: [{ id: 9, name: 'work', color: '#222222' }],
      type: 'task',
    });
  });

  it('adds type:habit and type:board to each item', async () => {
    prisma.habit.findMany.mockResolvedValueOnce([
      { id: 2, name: 'Gym', color: '#0f0', is_active: true },
    ]);
    prisma.board.findMany.mockResolvedValueOnce([{ id: 4, name: 'Main' }]);
    const out = await service.search(1, 'x');
    expect(out.habits[0].type).toBe('habit');
    expect(out.boards[0].type).toBe('board');
  });

  it('limits tasks to 20, habits/boards to 10', async () => {
    await service.search(1, 'x');
    expect(prisma.task.findMany.mock.calls[0][0].take).toBe(20);
    expect(prisma.habit.findMany.mock.calls[0][0].take).toBe(10);
    expect(prisma.board.findMany.mock.calls[0][0].take).toBe(10);
  });
});
