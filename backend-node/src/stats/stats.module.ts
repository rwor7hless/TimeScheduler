import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

/**
 * Phase 10 — ports `backend/app/routers/stats.py` + `services/stats.py`.
 * Exports `StatsService` so the export module can reuse it for
 * `/api/export/stats`.
 */
@Module({
  imports: [AuthModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
