import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatsModule } from '../stats/stats.module';
import { ExportController } from './export.controller';

/**
 * Phase 10 — ports `backend/app/routers/export.py`. Reuses StatsService
 * for the `/export/stats` endpoint; task export reads Prisma directly.
 */
@Module({
  imports: [AuthModule, StatsModule],
  controllers: [ExportController],
})
export class ExportModule {}
