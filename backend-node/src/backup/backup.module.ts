import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { PgDumpStreamer } from './pg-dump.streamer';
import { S3BackupConfigService } from './s3-backup.config';
import { S3BackupService } from './s3-backup.service';
import { S3BackupSchedulerService } from './s3-backup-scheduler.service';
import { S3ClientFactory } from './s3-client.factory';

/**
 * Phase 10 — ports `backend/app/routers/backup.py` + `services/backup.py`
 * + the APScheduler periodic-backup job. Cloud.ru S3 streaming-backup stack
 * (`S3BackupService` + daily 03:00 МСК cron) is registered here too — without
 * this the `@Cron` decorator on `S3BackupSchedulerService` never wires up.
 */
@Module({
  imports: [AuthModule],
  controllers: [BackupController],
  providers: [
    BackupService,
    BackupSchedulerService,
    S3BackupConfigService,
    S3ClientFactory,
    PgDumpStreamer,
    S3BackupService,
    S3BackupSchedulerService,
  ],
  exports: [BackupService, S3BackupService],
})
export class BackupModule {}
