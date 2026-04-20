import { ConfigService } from '@nestjs/config';
import { TelegramPollingFallbackService } from './telegram-polling-fallback.service';
import { TelegramService } from './telegram.service';

function cfg(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

function tgSvc(): { handleUpdate: jest.Mock } {
  return { handleUpdate: jest.fn().mockResolvedValue(undefined) };
}

describe('TelegramPollingFallbackService', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
  });

  it('does nothing when token is missing', async () => {
    let called = 0;
    global.fetch = (async () => {
      called++;
      return { ok: true } as Response;
    }) as typeof global.fetch;
    const svc = new TelegramPollingFallbackService(cfg({}), tgSvc() as unknown as TelegramService);
    await svc.poll();
    expect(called).toBe(0);
  });

  it('does nothing when webhook URL is set', async () => {
    let called = 0;
    global.fetch = (async () => {
      called++;
      return { ok: true } as Response;
    }) as typeof global.fetch;
    const svc = new TelegramPollingFallbackService(
      cfg({ TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_WEBHOOK_URL: 'https://x' }),
      tgSvc() as unknown as TelegramService,
    );
    await svc.poll();
    expect(called).toBe(0);
  });

  it('polls getUpdates when only token is set; dispatches each update', async () => {
    const seenUrls: string[] = [];
    global.fetch = (async (url: string) => {
      seenUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: [
            { update_id: 5, message: { text: '/start', chat: { id: 1 } } },
            { update_id: 9, message: { text: 'hi', chat: { id: 1 } } },
          ],
        }),
        text: async () => '',
      } as Response;
    }) as typeof global.fetch;
    const tg = tgSvc();
    const svc = new TelegramPollingFallbackService(
      cfg({ TELEGRAM_BOT_TOKEN: 'TOKEN' }),
      tg as unknown as TelegramService,
    );
    await svc.poll();
    expect(seenUrls[0]).toContain('https://api.telegram.org/botTOKEN/getUpdates');
    expect(seenUrls[0]).toContain('offset=1');
    expect(tg.handleUpdate).toHaveBeenCalledTimes(2);

    // After processing, lastUpdateId advances to 9 → next poll uses offset=10.
    await svc.poll();
    expect(seenUrls[1]).toContain('offset=10');
  });

  it('survives a fetch failure', async () => {
    global.fetch = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof global.fetch;
    const tg = tgSvc();
    const svc = new TelegramPollingFallbackService(
      cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
      tg as unknown as TelegramService,
    );
    await expect(svc.poll()).resolves.toBeUndefined();
    expect(tg.handleUpdate).not.toHaveBeenCalled();
  });
});
