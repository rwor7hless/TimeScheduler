import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { S3BackupService } from './s3-backup.service';

/**
 * Daily Postgres → Cloud.ru S3 backup at 03:00 Europe/Moscow.
 *
 * `@Cron` decorator only accepts literal arguments, so the schedule and
 * timezone are hardcoded here rather than read from env. To change cadence
 * edit this file directly. The `name` is used by `SchedulerRegistry` for
 * lookup if we ever need to inspect or pause the job.
 *
 * Idempotency: if a previous run is still in flight (slow upload, hung
 * pg_dump), the next tick is skipped and a warning logged. Mirrors the
 * `isRunning` pattern from `reports-scheduler.service.ts`.
 */
@Injectable()
export class S3BackupSchedulerService {
  private readonly logger = new Logger(S3BackupSchedulerService.name);
  private isRunning = false;

  constructor(private readonly s3Backup: S3BackupService) {}

  @Cron('0 3 * * *', { name: 's3-daily-backup', timeZone: 'Europe/Moscow' })
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('S3 backup cron already running — skipping this tick.');
      return;
    }

    this.isRunning = true;
    try {
      await this.s3Backup.run();
    } catch (err) {
      // Notification has already fired inside s3Backup.run(); we just need to
      // make sure the cron doesn't crash the process.
      this.logger.error(
        `Scheduled backup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
