import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminBootstrapService } from './admin-bootstrap.service';

/**
 * Bootstrap module. Currently wires only the admin-user lifecycle service;
 * the startup scheduler jobs (Telegram polling, weekly report cron, DB
 * backup) land in Phase 6.
 */
@Module({
  imports: [AuthModule],
  providers: [AdminBootstrapService],
})
export class BootstrapModule {}
