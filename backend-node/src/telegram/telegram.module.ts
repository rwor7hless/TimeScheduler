import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelegramController } from './telegram.controller';
import { TelegramPollingFallbackService } from './telegram-polling-fallback.service';
import { TelegramRemindersService } from './telegram-reminders.service';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { WebhookSetupService } from './webhook-setup.service';

/**
 * Phase 9 — replaces the Python long-poll loop with Telegram webhooks and
 * lands the per-minute reminders cron (deferred from Phase 6).
 *
 *  - TelegramController       → JWT-protected status/connect CRUD.
 *  - TelegramWebhookController → public webhook guarded by timingSafeEqual
 *                                 on the shared secret.
 *  - WebhookSetupService      → registers webhook on bootstrap.
 *  - TelegramPollingFallbackService → dev-only long-poll when no webhook URL.
 *  - TelegramRemindersService → per-minute cron for task-scheduled reminders.
 */
@Module({
  imports: [AuthModule],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [
    TelegramService,
    WebhookSetupService,
    TelegramPollingFallbackService,
    TelegramRemindersService,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
