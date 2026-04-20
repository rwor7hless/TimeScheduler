import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';

/**
 * On application bootstrap, register our webhook URL with Telegram if both
 * `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_URL` are set. Failures during
 * `setWebhook` are logged at WARN — we never crash the process because
 * Telegram is an optional integration.
 *
 * When only `TELEGRAM_BOT_TOKEN` is set, the dev-fallback polling service
 * kicks in instead (see `telegram-polling-fallback.service.ts`).
 */
@Injectable()
export class WebhookSetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WebhookSetupService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL') ?? '';
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';

    if (!token) {
      this.logger.debug('Telegram disabled (TELEGRAM_BOT_TOKEN not set).');
      return;
    }

    if (!webhookUrl) {
      this.logger.log('Telegram webhook URL not configured, falling back to long-poll (dev mode).');
      return;
    }

    if (!secret) {
      this.logger.warn(
        'TELEGRAM_WEBHOOK_URL is set but TELEGRAM_WEBHOOK_SECRET is empty — skipping setWebhook.',
      );
      return;
    }

    const base = webhookUrl.replace(/\/+$/, '');
    const fullUrl = `${base}/api/telegram/webhook/${secret}`;

    try {
      await this.telegram.setWebhook(fullUrl, secret);
      this.logger.log(`Telegram webhook registered at ${fullUrl}`);
    } catch (err) {
      this.logger.warn(`Failed to register Telegram webhook: ${String(err)}`);
    }
  }
}
