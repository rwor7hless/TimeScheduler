import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { CleanDbService } from './clean-db.service';
import { StuckReportsService } from './stuck-reports.service';

/**
 * Bootstrap module. Wires the bootstrap-time lifecycle services that run
 * once on application start. Nest calls `OnApplicationBootstrap` on
 * providers in the order they're declared in this array, so the
 * sequence below is load-bearing:
 *
 *   1. CleanDbService       — if CLEAN_DB_ON_STARTUP=true, truncate
 *                             public tables (grace-period awaited
 *                             before the TRUNCATE runs, so the rest of
 *                             bootstrap always sees a settled DB).
 *   2. StuckReportsService  — reset in_progress weekly reports left
 *                             over from a crashed previous run. No-op
 *                             on a freshly cleaned DB.
 *   3. AdminBootstrapService — re-seed the admin user last, so it
 *                             survives a CLEAN_DB_ON_STARTUP truncate.
 *
 * Domain cron jobs (backup, telegram, budget, weekly-report) are wired
 * in later phases alongside their respective domain services.
 */
@Module({
  imports: [AuthModule],
  providers: [CleanDbService, StuckReportsService, AdminBootstrapService],
})
export class BootstrapModule {}
