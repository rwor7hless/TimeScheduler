import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

/**
 * Ports the weekly-report APScheduler job from `backend/app/main.py` — runs
 * every Sunday at 21:00 in `USER_TIMEZONE` (Europe/Moscow by default).
 *
 * Replaces APScheduler's `max_instances=1` with a per-instance `isRunning`
 * boolean: if the previous run is still in flight when the cron fires
 * again (e.g. a 3h hang), we skip this tick and log a warning.
 *
 * Only generates reports for users with `can_request_summary=true`
 * (admins are implicitly eligible via the `OR` condition below). No-ops
 * when the configured LLM provider has no API key.
 */
@Injectable()
export class ReportsSchedulerService {
  private readonly logger = new Logger(ReportsSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 21 * * 0', { name: 'weekly-reports', timeZone: 'Europe/Moscow' })
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Weekly-report cron already running — skipping this tick.');
      return;
    }
    if (!this.llm.llmAvailable()) {
      this.logger.log(
        `Weekly-report cron skipped — LLM unavailable: ${this.llm.llmUnavailableReason()}`,
      );
      return;
    }

    this.isRunning = true;
    try {
      const users = await this.prisma.user.findMany({
        where: { OR: [{ is_admin: true }, { can_request_summary: true }] },
      });
      const weekStart = ReportsService.mondayOf(new Date());
      this.logger.log(
        `Starting weekly reports for ${users.length} user(s), week=${weekStart
          .toISOString()
          .slice(0, 10)}`,
      );
      for (const u of users) {
        try {
          await this.reports.generateReportForUser(u.id, weekStart);
        } catch (err) {
          this.logger.error(`generateReportForUser failed for user_id=${u.id}: ${String(err)}`);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
