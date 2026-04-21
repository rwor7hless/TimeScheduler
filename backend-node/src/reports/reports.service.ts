import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, WeeklyReport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { NtfyService } from '../ntfy/ntfy.service';
import { WeeklyDataService } from './weekly-data.service';
import {
  ANGLE_SEEDS as WEEKLY_ANGLES,
  buildWeeklyPrompt,
} from '../llm/prompts/weekly-report.prompt';
import { buildPetPrompt } from '../llm/prompts/pet-tip.prompt';
import {
  PERSONAS,
  parseAndValidate,
  pickPersona,
} from '../llm/prompts/pet-personas.prompt';

/**
 * If a report has been stuck in `in_progress` longer than this, we assume
 * the stream died (client dropped, server crashed mid-generation) and
 * allow a retry. Mirrors the Python `STALE_IN_PROGRESS = 3 minutes`.
 */
export const STALE_IN_PROGRESS_MS = 3 * 60 * 1000;

export interface DailyTipPersonaDto {
  id: string;
  name: string;
  eyes_l: string;
  eyes_r: string;
}

export interface DailyTipResult {
  date: string;
  disabled?: boolean;
  persona: DailyTipPersonaDto | null;
  short: string | null;
  long: string | null;
}

type DailyTipCacheEntry = {
  date: string;
  personaId: string;
  persona: DailyTipPersonaDto;
  short: string;
  long: string;
};

/**
 * Non-stream orchestration for reports. The SSE stream lives in
 * `report-stream.controller.ts` so the `@Res()` escape hatch stays
 * isolated from the regular controller.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly dailyTipCache = new Map<number, DailyTipCacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly ntfy: NtfyService,
    private readonly weeklyData: WeeklyDataService,
    private readonly config: ConfigService,
  ) {}

  static todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  static mondayOf(d: Date): Date {
    const jsDay = d.getUTCDay();
    const weekdayPy = (jsDay + 6) % 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - weekdayPy));
  }

  static parseWeekStart(s: string): Date {
    // Expect YYYY-MM-DD
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
      throw new ForbiddenException('week_start должен быть YYYY-MM-DD');
    }
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  async list(userId: number, limit: number): Promise<WeeklyReport[]> {
    return this.prisma.weeklyReport.findMany({
      where: { user_id: userId },
      orderBy: { week_start: 'desc' },
      take: limit,
    });
  }

  private isStaleInProgress(report: WeeklyReport): boolean {
    if (report.status !== 'in_progress') return false;
    if (!report.updated_at) return true;
    return Date.now() - report.updated_at.getTime() > STALE_IN_PROGRESS_MS;
  }

  async generate(userId: number, weekStart?: string): Promise<WeeklyReport> {
    const ws = weekStart
      ? ReportsService.parseWeekStart(weekStart)
      : ReportsService.mondayOf(new Date());

    const existing = await this.prisma.weeklyReport.findUnique({
      where: { user_id_week_start: { user_id: userId, week_start: ws } },
    });

    if (existing) {
      return this.prisma.weeklyReport.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          content: null,
          error_msg: null,
          updated_at: new Date(),
        },
      });
    }

    return this.prisma.weeklyReport.create({
      data: {
        user_id: userId,
        week_start: ws,
        status: 'pending',
        updated_at: new Date(),
      },
    });
  }

  async requestSummary(user: User): Promise<WeeklyReport> {
    if (!(user.is_admin || user.can_request_summary)) {
      throw new ForbiddenException('Нет права запрашивать саммари. Обратитесь к администратору.');
    }
    const reason = this.llm.llmUnavailableReason();
    if (reason) {
      throw new ServiceUnavailableException(reason);
    }

    const ws = ReportsService.mondayOf(new Date());
    const existing = await this.prisma.weeklyReport.findUnique({
      where: { user_id_week_start: { user_id: user.id, week_start: ws } },
    });

    if (!existing) {
      return this.prisma.weeklyReport.create({
        data: {
          user_id: user.id,
          week_start: ws,
          status: 'pending',
          updated_at: new Date(),
        },
      });
    }

    if (existing.status === 'in_progress' && !this.isStaleInProgress(existing)) {
      // Already generating in another tab — don't steal the session.
      return existing;
    }

    return this.prisma.weeklyReport.update({
      where: { id: existing.id },
      data: { status: 'pending', content: null, error_msg: null, updated_at: new Date() },
    });
  }

  async testPush(): Promise<{ ok: boolean; topic?: string; server?: string; error?: string }> {
    return this.ntfy.send('TimeScheduler работает', 'Пуш-уведомления настроены. Всё ок.', {
      tags: ['white_check_mark'],
      priority: 'default',
    });
  }

  async dailyTip(user: User, forcedPersona?: string): Promise<DailyTipResult> {
    const today = ReportsService.todayIso();
    if (!this.llm.llmAvailable()) {
      return { date: today, disabled: true, persona: null, short: null, long: null };
    }

    // Admin-only persona override; bypasses cache so switching reflects immediately.
    const overrideId =
      forcedPersona && user.is_admin && forcedPersona in PERSONAS ? forcedPersona : undefined;

    if (!overrideId) {
      const cached = this.dailyTipCache.get(user.id);
      if (cached && cached.date === today) {
        return {
          date: today,
          persona: cached.persona,
          short: cached.short,
          long: cached.long,
        };
      }
    }

    const todayStart = new Date(today + 'T00:00:00.000Z');
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const base = {
      user_id: user.id,
      deleted_at: null,
      status: { not: 'DONE' as const },
    };

    const [myDayRows, schedRows, deadlineRows, overdueRows, habitNames] = await Promise.all([
      this.prisma.task.findMany({
        where: { ...base, my_day: true },
        select: { title: true },
        take: 6,
      }),
      this.prisma.task.findMany({
        where: {
          ...base,
          my_day: false,
          scheduled_start: { gte: todayStart, lt: todayEnd },
        },
        select: { title: true },
        take: 4,
      }),
      this.prisma.task.findMany({
        where: {
          ...base,
          my_day: false,
          deadline: { gte: todayStart, lt: todayEnd },
          scheduled_start: null,
        },
        select: { title: true },
        take: 5,
      }),
      this.prisma.task.findMany({
        where: { ...base, deadline: { lt: todayStart } },
        select: { title: true },
        take: 3,
      }),
      this.prisma.habit.findMany({
        where: { user_id: user.id, is_active: true },
        select: { name: true },
        take: 6,
      }),
    ]);

    const myDayTitles = myDayRows.map((r) => r.title);
    const schedTitles = schedRows.map((r) => r.title);
    const allTasks = [...myDayTitles, ...schedTitles.filter((t) => !myDayTitles.includes(t))];

    const tz = this.config.get<string>('USER_TIMEZONE') ?? 'Europe/Moscow';
    let localHour: number;
    try {
      localHour = Number(
        new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          hour12: false,
          timeZone: tz,
        }).format(new Date()),
      );
      if (!Number.isFinite(localHour)) localHour = new Date().getUTCHours();
    } catch {
      localHour = new Date().getUTCHours();
    }

    const personaId =
      overrideId ??
      pickPersona({
        userId: user.id,
        todayIso: today,
        tasksCount: allTasks.length,
        overdueCount: overdueRows.length,
        deadlineTodayCount: deadlineRows.length,
        hour: localHour,
      });

    const messages = buildPetPrompt({
      personaId,
      tasks: allTasks,
      habits: habitNames.map((h) => h.name),
      deadlineToday: deadlineRows.map((r) => r.title),
      overdue: overdueRows.map((r) => r.title),
    });

    let raw: string;
    try {
      raw = await this.llm.chatCompletion(messages, { maxTokens: 260 });
    } catch (exc) {
      throw new ServiceUnavailableException(exc instanceof Error ? exc.message : String(exc));
    }

    let parsed;
    try {
      parsed = parseAndValidate(raw);
    } catch (exc) {
      throw new ServiceUnavailableException(exc instanceof Error ? exc.message : String(exc));
    }

    const p = PERSONAS[personaId];
    const personaDto: DailyTipPersonaDto = {
      id: personaId,
      name: p.name,
      eyes_l: p.eyes_l,
      eyes_r: p.eyes_r,
    };

    if (!overrideId) {
      this.dailyTipCache.set(user.id, {
        date: today,
        personaId,
        persona: personaDto,
        short: parsed.short,
        long: parsed.long,
      });
    }

    return {
      date: today,
      persona: personaDto,
      short: parsed.short,
      long: parsed.long,
    };
  }

  /**
   * Non-streaming report generation used by the weekly cron. Mirrors the
   * `generate_report_for_user` flow in `backend/app/services/weekly_report.py`.
   * NOT used by the SSE endpoint — that one streams deltas directly.
   */
  async generateReportForUser(userId: number, weekStart: Date): Promise<void> {
    let report = await this.prisma.weeklyReport.findUnique({
      where: { user_id_week_start: { user_id: userId, week_start: weekStart } },
    });
    if (!report) {
      report = await this.prisma.weeklyReport.create({
        data: {
          user_id: userId,
          week_start: weekStart,
          status: 'pending',
          updated_at: new Date(),
        },
      });
    }

    try {
      const data = await this.weeklyData.buildWeeklyData(userId, weekStart);
      const messages = buildWeeklyPrompt(data, {
        angleSeedIndex: Math.floor(Math.random() * WEEKLY_ANGLES.length),
      });
      const content = await this.llm.chatCompletion(messages);

      await this.prisma.weeklyReport.update({
        where: { id: report.id },
        data: {
          status: 'done',
          content: content.replace(/^\n+/, ''),
          error_msg: null,
          updated_at: new Date(),
        },
      });
      this.logger.log(
        `Weekly report generated for user_id=${userId}, week=${weekStart.toISOString().slice(0, 10)}`,
      );
      await this.ntfy.send(
        'Недельный отчёт готов',
        `AI разобрал твою неделю ${this.fmtDateShort(weekStart)} — загляни в уведомления.`,
        { tags: ['bar_chart'], priority: 'default' },
      );
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      await this.prisma.weeklyReport.update({
        where: { id: report.id },
        data: { status: 'error', error_msg: msg, updated_at: new Date() },
      });
      this.logger.error(`Weekly report failed for user_id=${userId}: ${msg}`);
    }
  }

  private fmtDateShort(d: Date): string {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
  }

  /** Testing hook: reset daily-tip cache for a specific user. */
  clearDailyTipCache(userId: number): void {
    this.dailyTipCache.delete(userId);
  }
}
