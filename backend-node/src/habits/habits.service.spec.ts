import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Habit, HabitLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HabitsService } from './habits.service';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 1,
    user_id: 1,
    name: 'Meditate',
    description: null,
    color: '#10B981',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeLog(overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: 1,
    habit_id: 1,
    date: new Date('2026-04-20T00:00:00.000Z'),
    completed_at: new Date('2026-04-20T08:30:00.000Z'),
    ...overrides,
  };
}

describe('HabitsService', () => {
  let service: HabitsService;
  let prisma: {
    habit: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    habitLog: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      habit: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      habitLog: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HabitsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(HabitsService);
  });

  describe('list', () => {
    it('includes logs eagerly and serializes dates as YYYY-MM-DD', async () => {
      prisma.habit.findMany.mockResolvedValue([{ ...makeHabit(), habit_logs: [makeLog()] }]);

      const result = await service.list(1);

      // Mirror Python's selectinload(Habit.logs) — Prisma calls it habit_logs
      // per the schema's relation name. Parity of the serialized shape is
      // what matters to the frontend.
      expect(prisma.habit.findMany).toHaveBeenCalledWith({
        where: { user_id: 1 },
        include: { habit_logs: true },
        orderBy: { created_at: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].logs[0]).toEqual({
        id: 1,
        habit_id: 1,
        date: '2026-04-20',
        completed_at: '2026-04-20T08:30:00.000Z',
      });
      expect(result[0]).not.toHaveProperty('user_id');
    });
  });

  describe('create', () => {
    it('defaults color to #10B981 and is_active to true', async () => {
      prisma.habit.create.mockResolvedValue({ ...makeHabit(), habit_logs: [] });
      await service.create(1, { name: 'Read' });
      expect(prisma.habit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 1,
          name: 'Read',
          color: '#10B981',
          is_active: true,
          description: null,
        }),
        include: { habit_logs: true },
      });
    });
  });

  describe('update', () => {
    it('404s on foreign habit', async () => {
      prisma.habit.findFirst.mockResolvedValue(null);
      await expect(service.update(1, 99, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('only writes explicitly-sent fields (exclude_unset semantics)', async () => {
      prisma.habit.findFirst.mockResolvedValue(makeHabit());
      prisma.habit.update.mockResolvedValue({ ...makeHabit(), habit_logs: [] });

      await service.update(1, 1, { name: 'Meditate daily' });

      expect(prisma.habit.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Meditate daily' },
        include: { habit_logs: true },
      });
    });

    it('no-ops empty body (matches AdminService.update pattern)', async () => {
      prisma.habit.findFirst.mockResolvedValue(makeHabit());
      prisma.habit.findUniqueOrThrow.mockResolvedValue({ ...makeHabit(), habit_logs: [] });

      await service.update(1, 1, {});

      expect(prisma.habit.update).not.toHaveBeenCalled();
      expect(prisma.habit.findUniqueOrThrow).toHaveBeenCalled();
    });
  });

  describe('toggleLog', () => {
    it('404s if the habit is not owned', async () => {
      prisma.habit.findFirst.mockResolvedValue(null);
      await expect(service.toggleLog(1, 99, { date: '2026-04-20' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('creates a log on first call, returns serialized log with YYYY-MM-DD date', async () => {
      prisma.habit.findFirst.mockResolvedValue(makeHabit());
      prisma.habitLog.create.mockResolvedValue(makeLog());

      const result = await service.toggleLog(1, 1, { date: '2026-04-20' });

      expect(prisma.habitLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          habit_id: 1,
          date: new Date('2026-04-20T00:00:00.000Z'),
        }),
      });
      expect(result).toEqual({
        id: 1,
        habit_id: 1,
        date: '2026-04-20',
        completed_at: '2026-04-20T08:30:00.000Z',
      });
    });

    it('deletes existing log and returns null on second (toggle) call', async () => {
      prisma.habit.findFirst.mockResolvedValue(makeHabit());
      const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      prisma.habitLog.create.mockRejectedValue(p2002);
      prisma.habitLog.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.toggleLog(1, 1, { date: '2026-04-20' });

      expect(result).toBeNull();
      expect(prisma.habitLog.deleteMany).toHaveBeenCalledWith({
        where: { habit_id: 1, date: new Date('2026-04-20T00:00:00.000Z') },
      });
    });
  });

  describe('getLogs', () => {
    it('404s if the habit is not owned (prevents cross-user log enumeration)', async () => {
      prisma.habit.findFirst.mockResolvedValue(null);
      await expect(service.getLogs(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('applies from_date/to_date filters as inclusive date-only bounds', async () => {
      prisma.habit.findFirst.mockResolvedValue(makeHabit());
      prisma.habitLog.findMany.mockResolvedValue([makeLog()]);

      await service.getLogs(1, 1, '2026-04-01', '2026-04-30');

      expect(prisma.habitLog.findMany).toHaveBeenCalledWith({
        where: {
          habit_id: 1,
          date: {
            gte: new Date('2026-04-01T00:00:00.000Z'),
            lte: new Date('2026-04-30T00:00:00.000Z'),
          },
        },
        orderBy: { date: 'asc' },
      });
    });
  });
});
