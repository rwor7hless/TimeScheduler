import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramUpdate } from './dto/telegram-update';

/**
 * Ports `backend/app/services/telegram_bot.py`.
 *
 * Thin HTTP wrapper around the Telegram Bot API + the `/start` handshake that
 * binds a Telegram chat to a one-time `TelegramKey`. All fetch errors are
 * swallowed and logged — Telegram being down must never crash our app.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private token(): string {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  private baseUrl(): string {
    return `https://api.telegram.org/bot${this.token()}`;
  }

  /** Random 32-byte url-safe token. Matches Python's `secrets.token_urlsafe(32)`. */
  generateKey(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * POST `sendMessage`. Returns silently on any error — Python also returns
   * `False` instead of throwing for the same reason (the caller is usually
   * a cron job and can't do anything useful with the exception).
   */
  async sendMessage(
    chatId: string,
    text: string,
    opts: { parseMode?: string } = {},
  ): Promise<void> {
    const token = this.token();
    if (!token) {
      return;
    }
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (opts.parseMode) {
      body.parse_mode = opts.parseMode;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(`${this.baseUrl()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        this.logger.warn(`Telegram sendMessage HTTP ${resp.status}: ${txt.slice(0, 200)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Telegram sendMessage failed: ${msg}`);
    }
  }

  /**
   * POST `setWebhook` — registers our public URL with Telegram. The
   * `secret_token` is included in every subsequent webhook request as
   * `X-Telegram-Bot-Api-Secret-Token`.
   */
  async setWebhook(url: string, secretToken: string): Promise<void> {
    const token = this.token();
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not set');
    }
    const resp = await fetch(`${this.baseUrl()}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secretToken }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`setWebhook HTTP ${resp.status}: ${txt.slice(0, 200)}`);
    }
  }

  /** POST `deleteWebhook` — useful for dev when switching back to long-poll. */
  async deleteWebhook(): Promise<void> {
    const token = this.token();
    if (!token) {
      return;
    }
    try {
      await fetch(`${this.baseUrl()}/deleteWebhook`, { method: 'POST' });
    } catch (err) {
      this.logger.warn(`Telegram deleteWebhook failed: ${String(err)}`);
    }
  }

  /**
   * Entry point called by both the webhook controller and the dev-fallback
   * long-poll service. `/start` replies with a fresh (or existing) key that
   * the user pastes into the web UI. Anything else is ignored.
   *
   * MarkdownV2 rules: the key contains `-` / `_` / `.` which would each need
   * backslash-escaping outside a code span, so we wrap it in backticks. This
   * mirrors the Python `_handle_start` formatting byte-for-byte.
   */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      const message = update.message ?? update.edited_message;
      if (!message) {
        return;
      }
      const text = (message.text ?? '').trim();
      const chatId = message.chat?.id;
      if (chatId === undefined || chatId === null || chatId === '') {
        return;
      }
      const chatIdStr = String(chatId);

      if (!text.startsWith('/start')) {
        return;
      }

      const reply = await this.handleStart(chatIdStr);
      await this.sendMessage(chatIdStr, reply, { parseMode: 'MarkdownV2' });
    } catch (err) {
      this.logger.error(`handleUpdate failed: ${String(err)}`);
    }
  }

  private async handleStart(chatId: string): Promise<string> {
    const existing = await this.prisma.telegramKey.findFirst({ where: { chat_id: chatId } });

    let key: string;
    let intro: string;

    if (existing) {
      key = existing.key;
      intro = 'У вас уже есть ключ:\n\n';
    } else {
      // Generate with collision retry — matches Python loop in `_handle_start`.
      let candidate = this.generateKey();
      // Bounded retry — realistically never collides, but defensive.
      for (let i = 0; i < 5; i++) {
        const collision = await this.prisma.telegramKey.findUnique({ where: { key: candidate } });
        if (!collision) break;
        candidate = this.generateKey();
      }
      key = candidate;
      await this.prisma.telegramKey.create({
        data: { key, chat_id: chatId, created_at: new Date() },
      });
      intro = 'Ваш ключ для TimeScheduler:\n\n';
    }

    return (
      intro +
      `\`${key}\`\n\n` +
      'Вставьте его в настройках приложения \\(кнопка Telegram в шапке\\)\\.'
    );
  }
}
