import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { WebhookSetupService } from './webhook-setup.service';

function cfg(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

function tgSvc(): { setWebhook: jest.Mock } {
  return { setWebhook: jest.fn() };
}

describe('WebhookSetupService', () => {
  it('no-ops when TELEGRAM_BOT_TOKEN is missing', async () => {
    const tg = tgSvc();
    const svc = new WebhookSetupService(cfg({}), tg as unknown as TelegramService);
    await svc.onApplicationBootstrap();
    expect(tg.setWebhook).not.toHaveBeenCalled();
  });

  it('no-ops when TELEGRAM_WEBHOOK_URL is missing (dev fallback mode)', async () => {
    const tg = tgSvc();
    const svc = new WebhookSetupService(
      cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
      tg as unknown as TelegramService,
    );
    await svc.onApplicationBootstrap();
    expect(tg.setWebhook).not.toHaveBeenCalled();
  });

  it('calls setWebhook with base + /api/telegram/webhook/<secret>', async () => {
    const tg = tgSvc();
    tg.setWebhook.mockResolvedValue(undefined);
    const svc = new WebhookSetupService(
      cfg({
        TELEGRAM_BOT_TOKEN: 'T',
        TELEGRAM_WEBHOOK_URL: 'https://example.com/',
        TELEGRAM_WEBHOOK_SECRET: 'S',
      }),
      tg as unknown as TelegramService,
    );
    await svc.onApplicationBootstrap();
    expect(tg.setWebhook).toHaveBeenCalledWith('https://example.com/api/telegram/webhook/S', 'S');
  });

  it('does not crash when setWebhook fails', async () => {
    const tg = tgSvc();
    tg.setWebhook.mockRejectedValue(new Error('nope'));
    const svc = new WebhookSetupService(
      cfg({
        TELEGRAM_BOT_TOKEN: 'T',
        TELEGRAM_WEBHOOK_URL: 'https://x',
        TELEGRAM_WEBHOOK_SECRET: 'S',
      }),
      tg as unknown as TelegramService,
    );
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('skips when URL set but secret missing', async () => {
    const tg = tgSvc();
    const svc = new WebhookSetupService(
      cfg({ TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_WEBHOOK_URL: 'https://x' }),
      tg as unknown as TelegramService,
    );
    await svc.onApplicationBootstrap();
    expect(tg.setWebhook).not.toHaveBeenCalled();
  });
});
