import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { S3BackupConfigService } from './s3-backup.config';

export interface BackupSuccessMeta {
  key: string;
  size: number;
  durationMs: number;
}

/**
 * Sends backup-flow notifications via the existing `TelegramService`.
 *
 * Recipient resolution order:
 *   1. `BACKUP_NOTIFY_CHAT_ID` env (operator override).
 *   2. The first `User` row with `is_admin=true AND telegram_chat_id IS NOT NULL`.
 *
 * If neither resolves, logs a warning and returns silently — backups must
 * never fail because we couldn't send a Telegram message.
 */
@Injectable()
export class BackupNotifierService {
  private readonly logger = new Logger(BackupNotifierService.name);

  constructor(
    private readonly config: S3BackupConfigService,
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
  ) {}

  async notifyFailure(error: unknown): Promise<void> {
    const chatId = await this.resolveChatId();
    if (!chatId) return;
    const message = error instanceof Error ? error.message : String(error);
    const text = `<b>Backup failed</b>\n<code>${BackupNotifierService.escapeHtml(message)}</code>`;
    await this.telegram.sendMessage(chatId, text, { parseMode: 'HTML' });
  }

  async notifySuccess(meta: BackupSuccessMeta): Promise<void> {
    const chatId = await this.resolveChatId();
    if (!chatId) return;
    const text = [
      '<b>Backup uploaded</b>',
      `key: <code>${BackupNotifierService.escapeHtml(meta.key)}</code>`,
      `size: ${BackupNotifierService.formatBytes(meta.size)}`,
      `duration: ${BackupNotifierService.formatDuration(meta.durationMs)}`,
    ].join('\n');
    await this.telegram.sendMessage(chatId, text, { parseMode: 'HTML' });
  }

  private async resolveChatId(): Promise<string | null> {
    const fromEnv = this.config.notifyChatId;
    if (fromEnv) return fromEnv;

    const admin = await this.prisma.user.findFirst({
      where: { is_admin: true, telegram_chat_id: { not: null } },
      select: { telegram_chat_id: true },
    });
    if (admin?.telegram_chat_id) return admin.telegram_chat_id;

    this.logger.warn(
      'Backup notification skipped: no chat id resolved (set BACKUP_NOTIFY_CHAT_ID or link an admin user to Telegram).',
    );
    return null;
  }

  private static escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private static formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024 ** 3).toFixed(2)} GB`;
  }

  private static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${(((ms % 60_000) / 1000) | 0)}s`;
  }
}
