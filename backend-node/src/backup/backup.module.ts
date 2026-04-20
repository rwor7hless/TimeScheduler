import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupSchedulerService } from './backup-scheduler.service';

/**
 * Phase 10 — ports `backend/app/routers/backup.py` + `services/backup.py`
 * + the APScheduler periodic-backup job.
 */
@Module({
  imports: [AuthModule],
  controllers: [BackupController],
  providers: [BackupService, BackupSchedulerService],
  exports: [BackupService],
})
export class BackupModule {}
