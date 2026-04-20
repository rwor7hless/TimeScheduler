import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { TelegramUpdate } from './dto/telegram-update';
import { TelegramService } from './telegram.service';

const POLL_TIMEOUT_SECONDS = 25;

/**
 * Dev-only fallback. Only active when `TELEGRAM_BOT_TOKEN` is set AND
 * `TELEGRAM_WEBHOOK_URL` is NOT set. Long-polls `getUpdates` every 30s.
 *
 * `lastUpdateId` lives in-memory — we deliberately do NOT touch the
 * `telegram_state` table (marked @deprecated in the Prisma schema).
 * Restart-loss is acceptable in dev; production runs webhooks.
 */
@Injectable()
export class TelegramPollingFallbackService {
  private readonly logger = new Logger(TelegramPollingFallbackService.name);
  private lastUpdateId = 0;
  private isRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
  ) {}

  @Interval(30_000)
  async poll(): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL') ?? '';
    if (!token || webhookUrl) {
      return;
    }
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      const url =
        `https://api.telegram.org/bot${token}/getUpdates` +
        `?offset=${this.lastUpdateId + 1}&timeout=${POLL_TIMEOUT_SECONDS}`;
      let resp: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), (POLL_TIMEOUT_SECONDS + 5) * 1000);
        resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
      } catch (err) {
        this.logger.debug(`Telegram getUpdates failed: ${String(err)}`);
        return;
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        this.logger.warn(`Telegram getUpdates HTTP ${resp.status}: ${txt.slice(0, 200)}`);
        return;
      }
      const payload = (await resp.json().catch(() => ({}))) as { result?: TelegramUpdate[] };
      const updates = payload.result ?? [];
      for (const update of updates) {
        const updateId = Number(update.update_id);
        if (Number.isFinite(updateId) && updateId > this.lastUpdateId) {
          this.lastUpdateId = updateId;
        }
        try {
          await this.telegram.handleUpdate(update);
        } catch (err) {
          this.logger.error(`Failed to handle update ${update.update_id}: ${String(err)}`);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
