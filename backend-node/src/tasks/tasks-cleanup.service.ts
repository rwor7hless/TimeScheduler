import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Runs at 00:00 in `USER_TIMEZONE`. Cleans up the prior day in "Today":
 *
 *  - done non-recurring → is_archived=true (stays in original board)
 *  - done recurring     → done=false, completed_at=null (lives on)
 *  - not-done my_day    → my_day=false (goes to backlog)
 *  - not-done scheduled-yesterday (no deadline-yesterday, not recurring)
 *                       → scheduled_start=null, scheduled_end=null (backlog)
 *  - not-done deadline-yesterday → leave alone (becomes overdue)
 *
 * `tick()` is the body of the cron, exported for testing.
 */
@Injectable()
export class TasksCleanupService {
  private readonly logger = new Logger(TasksCleanupService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Hook for tests to freeze time.
  protected now(): Date {
    return new Date();
  }

  @Cron('0 0 * * *', {
    name: 'today-cleanup',
    timeZone: process.env.USER_TIMEZONE || 'Europe/Moscow',
  })
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('today-cleanup cron already running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      await this.tick();
    } catch (err) {
      this.logger.error(`today-cleanup tick failed: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async tick(): Promise<void> {
    // Touch config so the linter doesn't flag it as unused — userTimezone is
    // read off the @Cron decorator at registration time, not here.
    void this.config;

    const now = this.now();
    const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDow = (yesterdayStart.getUTCDay() + 6) % 7;
    // ^ getUTCDay returns 0=Sun..6=Sat; convert to 0=Mon..6=Sun to match repeat_days.

    const candidates = await this.prisma.task.findMany({
      where: {
        is_archived: false,
        deleted_at: null,
        OR: [
          { scheduled_start: { gte: yesterdayStart, lt: now } },
          { deadline: { gte: yesterdayStart, lt: now } },
          { my_day: true },
          { repeat_days: { has: yesterdayDow } },
        ],
      },
      select: {
        id: true,
        done: true,
        my_day: true,
        scheduled_start: true,
        deadline: true,
        repeat_days: true,
      },
    });

    const archiveIds: number[] = [];
    const resetIds: number[] = [];
    const myDayClearIds: number[] = [];
    const schedClearIds: number[] = [];

    for (const t of candidates) {
      const isRecurring = Array.isArray(t.repeat_days) && t.repeat_days.length > 0;
      const hadDeadlineYesterday =
        !!t.deadline && t.deadline >= yesterdayStart && t.deadline < now;
      const scheduledYesterday =
        !!t.scheduled_start && t.scheduled_start >= yesterdayStart && t.scheduled_start < now;

      if (t.done) {
        if (isRecurring) resetIds.push(t.id);
        else archiveIds.push(t.id);
        continue;
      }

      if (t.my_day) myDayClearIds.push(t.id);
      if (scheduledYesterday && !isRecurring && !hadDeadlineYesterday) {
        schedClearIds.push(t.id);
      }
      // hadDeadlineYesterday & not my_day & not done → leave alone (Просрочено)
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { id: { in: archiveIds } },
        data: { is_archived: true },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: resetIds } },
        data: { done: false, completed_at: null },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: myDayClearIds } },
        data: { my_day: false },
      }),
      this.prisma.task.updateMany({
        where: { id: { in: schedClearIds } },
        data: { scheduled_start: null, scheduled_end: null },
      }),
    ]);

    this.logger.log(
      `today-cleanup: archived=${archiveIds.length} reset=${resetIds.length} ` +
        `myDayCleared=${myDayClearIds.length} schedCleared=${schedClearIds.length}`,
    );
  }
}
