import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';

/**
 * Ports `send_telegram_reminders` from `backend/app/services/telegram_bot.py`.
 *
 * Every minute, finds tasks where `tg_remind=true`, `tg_reminded=false`,
 * `tg_remind_at <= now`, and the owning user has a `telegram_chat_id`.
 * Sends the reminder via Telegram and marks the task as reminded.
 *
 * Scheduled times are formatted in `USER_TIMEZONE` (default Europe/Moscow)
 * matching Python's `ZoneInfo(settings.user_timezone)` conversion. UTC rows
 * in the DB → local display.
 */
@Injectable()
export class TelegramRemindersService {
  private readonly logger = new Logger(TelegramRemindersService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'telegram-reminders' })
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('telegram-reminders cron already running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      const token = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
      if (!token) return;

      const now = new Date();
      const rows = await this.prisma.task.findMany({
        where: {
          tg_remind: true,
          tg_reminded: false,
          tg_remind_at: { lte: now },
          users: { telegram_chat_id: { not: null } },
        },
        include: { users: true },
      });

      const tz = this.config.get<string>('USER_TIMEZONE') ?? 'Europe/Moscow';

      for (const task of rows) {
        const chatId = task.users.telegram_chat_id;
        if (!chatId) continue;

        const timeStr = this.formatScheduled(task.scheduled_start, tz);
        const text = `Напоминание о "${task.title}", запланировано на ${timeStr}. Не пропустите.`;

        await this.telegram.sendMessage(chatId, text);
        await this.prisma.task.update({ where: { id: task.id }, data: { tg_reminded: true } });
      }
    } catch (err) {
      this.logger.error(`telegram-reminders cron failed: ${String(err)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private formatScheduled(scheduled: Date | null, timeZone: string): string {
    if (!scheduled) return 'не указано';
    // Python uses `%d.%m.%Y %H:%M` in the user's timezone. Intl.DateTimeFormat
    // with ru-RU + numeric components yields `DD.MM.YYYY` and `HH:MM`.
    try {
      const fmt = new Intl.DateTimeFormat('ru-RU', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(scheduled);
      const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
      const day = get('day');
      const month = get('month');
      const year = get('year');
      const hour = get('hour');
      const minute = get('minute');
      return `${day}.${month}.${year} ${hour}:${minute}`;
    } catch {
      return scheduled.toISOString();
    }
  }
}
