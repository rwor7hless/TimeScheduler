import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramService } from './telegram.service';

function cfg(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

function svc(): { handleUpdate: jest.Mock } {
  return { handleUpdate: jest.fn() };
}

describe('TelegramWebhookController', () => {
  it('403 when TELEGRAM_WEBHOOK_SECRET is not configured', async () => {
    const tg = svc();
    const ctrl = new TelegramWebhookController(cfg({}), tg as unknown as TelegramService);
    await expect(ctrl.receive('anything', 'anything', { update_id: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tg.handleUpdate).not.toHaveBeenCalled();
  });

  it('403 when header secret does not match', async () => {
    const tg = svc();
    const ctrl = new TelegramWebhookController(
      cfg({ TELEGRAM_WEBHOOK_SECRET: 'S' }),
      tg as unknown as TelegramService,
    );
    await expect(ctrl.receive('S', 'WRONG', { update_id: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('403 when URL param does not match', async () => {
    const tg = svc();
    const ctrl = new TelegramWebhookController(
      cfg({ TELEGRAM_WEBHOOK_SECRET: 'S' }),
      tg as unknown as TelegramService,
    );
    await expect(ctrl.receive('WRONG', 'S', { update_id: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('403 when header missing', async () => {
    const tg = svc();
    const ctrl = new TelegramWebhookController(
      cfg({ TELEGRAM_WEBHOOK_SECRET: 'S' }),
      tg as unknown as TelegramService,
    );
    await expect(ctrl.receive('S', undefined, { update_id: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('200 + delegates when both secrets match', async () => {
    const tg = svc();
    tg.handleUpdate.mockResolvedValue(undefined);
    const ctrl = new TelegramWebhookController(
      cfg({ TELEGRAM_WEBHOOK_SECRET: 'abc123' }),
      tg as unknown as TelegramService,
    );
    const update = { update_id: 7, message: { text: '/start', chat: { id: 1 } } };
    const result = await ctrl.receive('abc123', 'abc123', update);
    expect(result).toEqual({ ok: true });
    expect(tg.handleUpdate).toHaveBeenCalledWith(update);
  });
});
