import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramRemindersService } from './telegram-reminders.service';
import { TelegramService } from './telegram.service';

function cfg(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

function fakePrisma(rows: unknown[]): {
  task: { findMany: jest.Mock; update: jest.Mock };
} {
  return {
    task: {
      findMany: jest.fn().mockResolvedValue(rows),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function tgSvc(): { sendMessage: jest.Mock } {
  return { sendMessage: jest.fn().mockResolvedValue(undefined) };
}

describe('TelegramRemindersService', () => {
  it('no-ops when TELEGRAM_BOT_TOKEN is empty', async () => {
    const prisma = fakePrisma([]);
    const tg = tgSvc();
    const svc = new TelegramRemindersService(
      prisma as unknown as PrismaService,
      tg as unknown as TelegramService,
      cfg({}),
    );
    await svc.run();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('sends one message per matching task and marks reminded', async () => {
    const scheduled = new Date(Date.UTC(2026, 3, 21, 9, 30, 0)); // 21 Apr 12:30 MSK
    const rows = [
      {
        id: 1,
        title: 'Task A',
        scheduled_start: scheduled,
        users: { telegram_chat_id: '42' },
      },
      {
        id: 2,
        title: 'Task B',
        scheduled_start: null,
        users: { telegram_chat_id: '99' },
      },
    ];
    const prisma = fakePrisma(rows);
    const tg = tgSvc();
    const svc = new TelegramRemindersService(
      prisma as unknown as PrismaService,
      tg as unknown as TelegramService,
      cfg({ TELEGRAM_BOT_TOKEN: 'T', USER_TIMEZONE: 'Europe/Moscow' }),
    );

    await svc.run();

    expect(tg.sendMessage).toHaveBeenCalledTimes(2);
    const firstCall = tg.sendMessage.mock.calls[0];
    expect(firstCall[0]).toBe('42');
    expect(firstCall[1]).toContain('Task A');
    expect(firstCall[1]).toContain('21.04.2026');
    expect(firstCall[1]).toContain('12:30');

    const secondCall = tg.sendMessage.mock.calls[1];
    expect(secondCall[1]).toContain('не указано');

    expect(prisma.task.update).toHaveBeenCalledTimes(2);
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { tg_reminded: true },
    });
  });

  it('skips tasks whose user has no telegram_chat_id', async () => {
    const rows = [{ id: 7, title: 'X', scheduled_start: null, users: { telegram_chat_id: null } }];
    const prisma = fakePrisma(rows);
    const tg = tgSvc();
    const svc = new TelegramRemindersService(
      prisma as unknown as PrismaService,
      tg as unknown as TelegramService,
      cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
    );
    await svc.run();
    expect(tg.sendMessage).not.toHaveBeenCalled();
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
