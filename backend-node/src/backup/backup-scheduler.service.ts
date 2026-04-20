import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BackupService } from './backup.service';

/**
 * Ports the APScheduler backup job from `backend/app/main.py` — runs every
 * `BACKUP_INTERVAL_HOURS` hours (default 24). We register the interval
 * dynamically in `onModuleInit` rather than via `@Interval` because the
 * period comes from runtime config, not a decorator literal.
 *
 * `isRunning` dedupes overlapping ticks — a pg_dump taking longer than the
 * interval (shouldn't happen at 24h but possible at 1h debug values) won't
 * spawn a second process on top of itself.
 */
@Injectable()
export class BackupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly backup: BackupService,
  ) {}

  onModuleInit(): void {
    const hoursRaw = this.config.get<string>('BACKUP_INTERVAL_HOURS') ?? '24';
    const hours = Number.parseFloat(hoursRaw);
    if (!Number.isFinite(hours) || hours <= 0) {
      this.logger.warn(`BACKUP_INTERVAL_HOURS=${hoursRaw} is invalid; backup scheduler disabled.`);
      return;
    }
    const intervalMs = Math.round(hours * 3600 * 1000);
    const handle = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.scheduler.addInterval('backup-interval', handle);
    this.logger.log(`Backup scheduler registered — every ${hours}h (${intervalMs}ms).`);
  }

  async tick(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Backup cron already running — skipping this tick.');
      return;
    }
    this.isRunning = true;
    try {
      const filename = await this.backup.runBackup();
      this.logger.log(`Backup completed: ${filename}`);
    } catch (err) {
      this.logger.error(`Backup failed: ${String(err)}`);
    } finally {
      this.isRunning = false;
    }
  }
}
