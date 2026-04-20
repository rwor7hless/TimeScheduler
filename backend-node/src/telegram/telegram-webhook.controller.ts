import * as crypto from 'crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramUpdate } from './dto/telegram-update';
import { TelegramService } from './telegram.service';

/**
 * Public Telegram webhook endpoint — NO JWT. Guarded by:
 *  1. `X-Telegram-Bot-Api-Secret-Token` header must match
 *     `TELEGRAM_WEBHOOK_SECRET` (timingSafeEqual).
 *  2. The `:secret` URL path param must ALSO match — defense in depth so
 *     even a leaked URL pattern is useless without the env-configured
 *     secret.
 *
 * Always returns 200 regardless of processing outcome: Telegram retries on
 * 4xx/5xx which would amplify noise if our handler threw. The secret guard
 * is the one exception — mismatched secret → 403 (Nest's ForbiddenException
 * is routed through the global filter into `{detail: ...}`).
 */
@Controller('telegram/webhook')
export class TelegramWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
  ) {}

  private safeEqual(a: string, b: string): boolean {
    // timingSafeEqual requires equal-length Buffers; bail early on length mismatch.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  }

  @Post(':secret')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('secret') urlSecret: string,
    @Headers('x-telegram-bot-api-secret-token') headerSecret: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
    if (!expected) {
      throw new ForbiddenException('Telegram webhook not configured');
    }

    const header = headerSecret ?? '';
    if (!this.safeEqual(header, expected) || !this.safeEqual(urlSecret, expected)) {
      throw new ForbiddenException('Invalid webhook secret');
    }

    await this.telegram.handleUpdate(update);
    return { ok: true };
  }
}
