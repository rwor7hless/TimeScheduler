import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { NtfyModule } from '../ntfy/ntfy.module';
import { ReportStreamController } from './report-stream.controller';
import { ReportsController } from './reports.controller';
import { ReportsSchedulerService } from './reports-scheduler.service';
import { ReportsService } from './reports.service';
import { WeeklyDataService } from './weekly-data.service';

/**
 * Ports `backend/app/routers/reports.py` + weekly cron from `main.py`.
 *
 * Provides:
 *  - ReportsController — list / generate / request-summary / test-push / daily-tip
 *  - ReportStreamController — raw @Res SSE for GET /:id/stream
 *  - WeeklyDataService — collects tasks + habits for the week
 *  - ReportsService — non-streaming orchestration + daily-tip cache
 *  - ReportsSchedulerService — Sunday 21:00 Europe/Moscow cron
 */
@Module({
  imports: [AuthModule, LlmModule, NtfyModule],
  controllers: [ReportsController, ReportStreamController],
  providers: [ReportsService, WeeklyDataService, ReportsSchedulerService],
  exports: [ReportsService],
})
export class ReportsModule {}
