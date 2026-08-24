import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, WeeklyReport } from '@prisma/client';
import { LlmService } from '../llm/llm.service';
import { NtfyService } from '../ntfy/ntfy.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { WeeklyDataService } from './weekly-data.service';

function makeConfig(): ConfigService {
  return { get: (_k: string) => 'Europe/Moscow' } as unknown as ConfigService;
}

function makeUser(o: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'u',
    password_hash: '$x',
    is_admin: false,
    can_request_summary: false,
    created_at: new Date(),
    telegram_chat_id: null,
    telegram_key: null,
    ...o,
  } as User;
}

function makeReport(o: Partial<WeeklyReport> = {}): WeeklyReport {
  return {
    id: 1,
    user_id: 1,
    week_start: new Date('2026-04-13T00:00:00.000Z'),
    status: 'pending',
    content: null,
    error_msg: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...o,
  } as WeeklyReport;
}

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    weeklyReport: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      ...((overrides.weeklyReport as object) ?? {}),
    },
    task: { findMany: jest.fn().mockResolvedValue([]), ...((overrides.task as object) ?? {}) },
    habit: { findMany: jest.fn().mockResolvedValue([]), ...((overrides.habit as object) ?? {}) },
  } as unknown as PrismaService;
}

function makeLlm(available: boolean, reason: string | null = null): LlmService {
  return {
    llmAvailable: () => available,
    llmUnavailableReason: () => reason,
    chatCompletion: jest.fn().mockResolvedValue('tip content'),
  } as unknown as LlmService;
}

function makeNtfy(): NtfyService {
  return { send: jest.fn().mockResolvedValue({ ok: true }) } as unknown as NtfyService;
}

function makeWeeklyData(): WeeklyDataService {
  return {
    buildWeeklyData: jest.fn(),
  } as unknown as WeeklyDataService;
}

describe('ReportsService', () => {
  describe('mondayOf', () => {
    it('returns Monday for a Wednesday', () => {
      const wed = new Date('2026-04-15T12:00:00.000Z'); // Wednesday
      const mon = ReportsService.mondayOf(wed);
      expect(mon.toISOString().slice(0, 10)).toBe('2026-04-13');
    });
    it('returns the same day for a Monday', () => {
      const mon = new Date('2026-04-13T00:00:00.000Z');
      expect(ReportsService.mondayOf(mon).toISOString().slice(0, 10)).toBe('2026-04-13');
    });
    it('returns previous Monday for a Sunday', () => {
      const sun = new Date('2026-04-19T12:00:00.000Z');
      expect(ReportsService.mondayOf(sun).toISOString().slice(0, 10)).toBe('2026-04-13');
    });
  });

  describe('parseWeekStart', () => {
    it('parses YYYY-MM-DD', () => {
      const d = ReportsService.parseWeekStart('2026-04-13');
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(3);
      expect(d.getUTCDate()).toBe(13);
    });
    it('throws on malformed string', () => {
      expect(() => ReportsService.parseWeekStart('2026/04/13')).toThrow();
    });
  });

  describe('generate', () => {
    it('creates a new pending report when none exists', async () => {
      const prisma = makePrisma();
      (prisma.weeklyReport.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.weeklyReport.create as jest.Mock).mockImplementation(
        ({ data }: { data: Partial<WeeklyReport> }) => Promise.resolve(makeReport(data)),
      );
      const svc = new ReportsService(prisma, makeLlm(true), makeNtfy(), makeWeeklyData(), makeConfig());
      const out = await svc.generate(1, '2026-04-13');
      expect(out.status).toBe('pending');
      expect(prisma.weeklyReport.create).toHaveBeenCalled();
    });

    it('resets an existing done report back to pending', async () => {
      const prisma = makePrisma();
      const existing = makeReport({ status: 'done', content: 'old' });
      (prisma.weeklyReport.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.weeklyReport.update as jest.Mock).mockImplementation(
        ({ data }: { data: Partial<WeeklyReport> }) =>
          Promise.resolve(makeReport({ ...existing, ...data })),
      );
      const svc = new ReportsService(prisma, makeLlm(true), makeNtfy(), makeWeeklyData(), makeConfig());
      const out = await svc.generate(1);
      expect(out.status).toBe('pending');
      expect(out.content).toBeNull();
    });
  });

  describe('requestSummary', () => {
    it('throws 403 when user has no permission', async () => {
      const svc = new ReportsService(makePrisma(), makeLlm(true), makeNtfy(), makeWeeklyData(), makeConfig());
      await expect(
        svc.requestSummary(makeUser({ is_admin: false, can_request_summary: false })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 503 when LLM is unavailable', async () => {
      const svc = new ReportsService(
        makePrisma(),
        makeLlm(false, 'no key'),
        makeNtfy(),
        makeWeeklyData(),
        makeConfig(),
      );
      await expect(svc.requestSummary(makeUser({ is_admin: true }))).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('returns an existing non-stale in_progress report untouched', async () => {
      const prisma = makePrisma();
      const existing = makeReport({ status: 'in_progress', updated_at: new Date() });
      (prisma.weeklyReport.findUnique as jest.Mock).mockResolvedValue(existing);
      const svc = new ReportsService(prisma, makeLlm(true), makeNtfy(), makeWeeklyData(), makeConfig());
      const out = await svc.requestSummary(makeUser({ can_request_summary: true }));
      expect(out).toBe(existing);
      expect(prisma.weeklyReport.update).not.toHaveBeenCalled();
    });

    it('resets a stale in_progress report to pending', async () => {
      const prisma = makePrisma();
      const stale = makeReport({
        status: 'in_progress',
        updated_at: new Date(Date.now() - 10 * 60 * 1000),
      });
      (prisma.weeklyReport.findUnique as jest.Mock).mockResolvedValue(stale);
      (prisma.weeklyReport.update as jest.Mock).mockImplementation(
        ({ data }: { data: Partial<WeeklyReport> }) =>
          Promise.resolve(makeReport({ ...stale, ...data })),
      );
      const svc = new ReportsService(prisma, makeLlm(true), makeNtfy(), makeWeeklyData(), makeConfig());
      const out = await svc.requestSummary(makeUser({ can_request_summary: true }));
      expect(out.status).toBe('pending');
    });
  });

  describe('testPush', () => {
    it('delegates to NtfyService.send', async () => {
      const ntfy = makeNtfy();
      const svc = new ReportsService(makePrisma(), makeLlm(true), ntfy, makeWeeklyData(), makeConfig());
      await svc.testPush();
      expect(ntfy.send).toHaveBeenCalledWith(
        'TimeScheduler работает',
        expect.any(String),
        expect.objectContaining({ priority: 'default' }),
      );
    });
  });

  describe('generateReportForUser', () => {
    it('marks report done on success and calls ntfy', async () => {
      const prisma = makePrisma();
      const report = makeReport();
      (prisma.weeklyReport.findUnique as jest.Mock).mockResolvedValue(report);
      const updateMock = prisma.weeklyReport.update as jest.Mock;
      updateMock.mockResolvedValue(report);

      const llm = makeLlm(true);
      (llm.chatCompletion as jest.Mock).mockResolvedValue('report content');

      const weekly = makeWeeklyData();
      (weekly.buildWeeklyData as jest.Mock).mockResolvedValue({
        week_start: '13.04.2026',
        week_end: '19.04.2026',
        projects: [],
        habits: [],
        budget: null,
      });

      const ntfy = makeNtfy();
      const svc = new ReportsService(prisma, llm, ntfy, weekly, makeConfig());
      await svc.generateReportForUser(1, new Date('2026-04-13T00:00:00.000Z'));

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'done' }) }),
      );
      expect(ntfy.send).toHaveBeenCalled();
    });

    it('marks report error on LLM failure', async () => {
      const prisma = makePrisma();
      const report = makeReport();
      (prisma.weeklyReport.findUnique as jest.Mock).mockResolvedValue(report);
      const updateMock = prisma.weeklyReport.update as jest.Mock;
      updateMock.mockResolvedValue(report);

      const llm = makeLlm(true);
      (llm.chatCompletion as jest.Mock).mockRejectedValue(new Error('boom'));

      const weekly = makeWeeklyData();
      (weekly.buildWeeklyData as jest.Mock).mockResolvedValue({
        week_start: '13.04.2026',
        week_end: '19.04.2026',
        projects: [],
        habits: [],
        budget: null,
      });

      const svc = new ReportsService(prisma, llm, makeNtfy(), weekly, makeConfig());
      await svc.generateReportForUser(1, new Date('2026-04-13T00:00:00.000Z'));
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'error', error_msg: 'boom' }),
        }),
      );
    });
  });
});
