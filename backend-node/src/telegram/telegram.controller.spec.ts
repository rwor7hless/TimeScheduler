import { NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramController } from './telegram.controller';

function fakePrisma(): {
  telegramKey: { findUnique: jest.Mock; delete: jest.Mock };
  user: { update: jest.Mock };
  $transaction: jest.Mock;
} {
  return {
    telegramKey: { findUnique: jest.fn(), delete: jest.fn() },
    user: { update: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

function mockUser(extra: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'u',
    password_hash: 'x',
    is_admin: true,
    created_at: new Date(),
    telegram_chat_id: null,
    telegram_key: null,
    can_request_summary: false,
    ...extra,
  } as User;
}

describe('TelegramController', () => {
  it('status returns false when telegram_chat_id is null', () => {
    const ctrl = new TelegramController(fakePrisma() as unknown as PrismaService);
    expect(ctrl.status(mockUser())).toEqual({ connected: false });
  });

  it('status returns true when telegram_chat_id is set', () => {
    const ctrl = new TelegramController(fakePrisma() as unknown as PrismaService);
    expect(ctrl.status(mockUser({ telegram_chat_id: '42' }))).toEqual({ connected: true });
  });

  it('connect binds the chat_id and consumes the key in a transaction', async () => {
    const prisma = fakePrisma();
    prisma.telegramKey.findUnique.mockResolvedValue({ id: 9, key: 'K', chat_id: '42' });
    const ctrl = new TelegramController(prisma as unknown as PrismaService);
    const result = await ctrl.connect(mockUser(), { key: 'K' });
    expect(result).toEqual({ connected: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('connect 404s when key is unknown', async () => {
    const prisma = fakePrisma();
    prisma.telegramKey.findUnique.mockResolvedValue(null);
    const ctrl = new TelegramController(prisma as unknown as PrismaService);
    await expect(ctrl.connect(mockUser(), { key: 'bogus' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('disconnect nulls both telegram_chat_id and telegram_key', async () => {
    const prisma = fakePrisma();
    prisma.user.update.mockResolvedValue(mockUser());
    const ctrl = new TelegramController(prisma as unknown as PrismaService);
    const result = await ctrl.disconnect(mockUser({ telegram_chat_id: '42', telegram_key: 'K' }));
    expect(result).toEqual({ connected: false });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { telegram_chat_id: null, telegram_key: null },
    });
  });
});
