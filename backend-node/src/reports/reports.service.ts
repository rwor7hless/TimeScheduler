import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { User, WeeklyReport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { NtfyService } from '../ntfy/ntfy.service';
import { WeeklyDataService } from './weekly-data.service';
import {
  ANGLE_SEEDS as WEEKLY_ANGLES,
  buildWeeklyPrompt,
} from '../llm/prompts/weekly-report.prompt';

/**
 * If a report has been stuck in `in_progress` longer than this, we assume
 * the stream died (client dropped, server crashed mid-generation) and
 * allow a retry. Mirrors the Python `STALE_IN_PROGRESS = 3 minutes`.
 */
export const STALE_IN_PROGRESS_MS = 3 * 60 * 1000;

/**
 * Non-stream orchestration for reports. The SSE stream lives in
 * `report-stream.controller.ts` so the `@Res()` escape hatch stays
 * isolated from the regular controller.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly ntfy: NtfyService,
    private readonly weeklyData: WeeklyDataService,
  ) {}

  static todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  static mondayOf(d: Date): Date {
    // День недели и сдвиг считаем по МСК (UTC+3, без DST). Возвращаем Date,
    // у которого UTC-поля совпадают с КАЛЕНДАРНОЙ датой МСК-понедельника —
    // ровно то, чего ждёт колонка `week_start @db.Date` в Prisma. Реальный
    // момент времени MSK-понедельника-00:00 (UTC Sun 21:00) считается
    // отдельно в WeeklyDataService при формировании временных границ.
    const TZ_OFFSET_MS = 3 * 3600 * 1000;
    const msk = new Date(d.getTime() + TZ_OFFSET_MS);
    const jsDay = msk.getUTCDay();
    const weekdayPy = (jsDay + 6) % 7;
    return new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - weekdayPy));
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
        // В schema.prisma на колонке created_at стоит жёстко прибитый
        // dbgenerated-дефолт ('2026-04-12 …') от старого `prisma db pull`.
        // Если не выставить явно — Postgres подставит ту дату, и в UI
        // окажется, что все отчёты «созданы 12 апреля». Выставляем сами.
        created_at: new Date(),
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
          created_at: new Date(),
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
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    try {
      const data = await this.weeklyData.buildWeeklyData(userId, weekStart);
      const messages = buildWeeklyPrompt(data, {
        angleSeedIndex: Math.floor(Math.random() * WEEKLY_ANGLES.length),
      });
      const rawContent = await this.llm.chatCompletion(messages);
      // Модель думает в <scratch>...</scratch> перед отчётом. Удаляем.
      const content = rawContent.replace(/<scratch>[\s\S]*?<\/scratch>\s*/i, '').replace(/^\n+/, '');

      await this.prisma.weeklyReport.update({
        where: { id: report.id },
        data: {
          status: 'done',
          content,
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
}
