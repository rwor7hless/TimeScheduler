import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';

function cfg(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

type FakePrisma = {
  telegramKey: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

function fakePrisma(): FakePrisma {
  return {
    telegramKey: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe('TelegramService', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
  });

  describe('sendMessage', () => {
    it('no-ops when token is empty', async () => {
      const calls: unknown[] = [];
      global.fetch = (async (...args: unknown[]) => {
        calls.push(args);
        return { ok: true } as Response;
      }) as typeof global.fetch;
      const svc = new TelegramService(cfg({}), fakePrisma() as unknown as PrismaService);
      await svc.sendMessage('1', 'hi');
      expect(calls).toHaveLength(0);
    });

    it('POSTs chat_id/text/parse_mode to Telegram sendMessage', async () => {
      const seen: { url?: string; init?: RequestInit } = {};
      global.fetch = (async (url: string, init?: RequestInit) => {
        seen.url = url;
        seen.init = init;
        return { ok: true, status: 200, text: async () => '' } as Response;
      }) as typeof global.fetch;
      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        fakePrisma() as unknown as PrismaService,
      );
      await svc.sendMessage('42', 'hello', { parseMode: 'MarkdownV2' });
      expect(seen.url).toBe('https://api.telegram.org/botT/sendMessage');
      const body = JSON.parse(seen.init?.body as string);
      expect(body).toEqual({ chat_id: '42', text: 'hello', parse_mode: 'MarkdownV2' });
    });

    it('swallows fetch errors', async () => {
      global.fetch = (async () => {
        throw new Error('boom');
      }) as typeof global.fetch;
      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        fakePrisma() as unknown as PrismaService,
      );
      await expect(svc.sendMessage('1', 'x')).resolves.toBeUndefined();
    });

    it('logs non-2xx responses but does not throw', async () => {
      global.fetch = (async () =>
        ({ ok: false, status: 400, text: async () => 'bad' }) as Response) as typeof global.fetch;
      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        fakePrisma() as unknown as PrismaService,
      );
      await expect(svc.sendMessage('1', 'x')).resolves.toBeUndefined();
    });
  });

  describe('setWebhook', () => {
    it('POSTs to setWebhook with url + secret_token', async () => {
      const seen: { url?: string; init?: RequestInit } = {};
      global.fetch = (async (url: string, init?: RequestInit) => {
        seen.url = url;
        seen.init = init;
        return { ok: true, status: 200, text: async () => '' } as Response;
      }) as typeof global.fetch;
      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        fakePrisma() as unknown as PrismaService,
      );
      await svc.setWebhook('https://x/api/telegram/webhook/S', 'S');
      expect(seen.url).toBe('https://api.telegram.org/botT/setWebhook');
      const body = JSON.parse(seen.init?.body as string);
      expect(body).toEqual({ url: 'https://x/api/telegram/webhook/S', secret_token: 'S' });
    });

    it('throws when token is missing', async () => {
      const svc = new TelegramService(cfg({}), fakePrisma() as unknown as PrismaService);
      await expect(svc.setWebhook('u', 's')).rejects.toThrow();
    });

    it('throws on non-2xx', async () => {
      global.fetch = (async () =>
        ({ ok: false, status: 500, text: async () => 'err' }) as Response) as typeof global.fetch;
      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        fakePrisma() as unknown as PrismaService,
      );
      await expect(svc.setWebhook('u', 's')).rejects.toThrow(/500/);
    });
  });

  describe('generateKey', () => {
    it('returns a url-safe string of reasonable length', () => {
      const svc = new TelegramService(cfg({}), fakePrisma() as unknown as PrismaService);
      const k = svc.generateKey();
      expect(k).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(k.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('handleUpdate', () => {
    it('creates a new TelegramKey on /start and sends MarkdownV2 reply', async () => {
      const prisma = fakePrisma();
      prisma.telegramKey.findFirst.mockResolvedValue(null);
      prisma.telegramKey.findUnique.mockResolvedValue(null);
      prisma.telegramKey.create.mockResolvedValue({});
      const sentBodies: unknown[] = [];
      global.fetch = (async (_u: string, init?: RequestInit) => {
        sentBodies.push(JSON.parse(init?.body as string));
        return { ok: true, status: 200, text: async () => '' } as Response;
      }) as typeof global.fetch;

      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        prisma as unknown as PrismaService,
      );
      await svc.handleUpdate({ update_id: 1, message: { text: '/start', chat: { id: 42 } } });

      expect(prisma.telegramKey.create).toHaveBeenCalledTimes(1);
      expect(sentBodies).toHaveLength(1);
      const body = sentBodies[0] as { chat_id: string; text: string; parse_mode?: string };
      expect(body.chat_id).toBe('42');
      expect(body.parse_mode).toBe('MarkdownV2');
      expect(body.text).toContain('`'); // key wrapped in backticks
      expect(body.text).toContain('Ваш ключ');
    });

    it('reuses existing key when chat already has one', async () => {
      const prisma = fakePrisma();
      prisma.telegramKey.findFirst.mockResolvedValue({ id: 7, chat_id: '42', key: 'EXISTING' });
      const sent: { text?: string }[] = [];
      global.fetch = (async (_u: string, init?: RequestInit) => {
        sent.push(JSON.parse(init?.body as string));
        return { ok: true, status: 200, text: async () => '' } as Response;
      }) as typeof global.fetch;

      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        prisma as unknown as PrismaService,
      );
      await svc.handleUpdate({ update_id: 2, message: { text: '/start', chat: { id: '42' } } });

      expect(prisma.telegramKey.create).not.toHaveBeenCalled();
      expect(sent[0].text).toContain('EXISTING');
      expect(sent[0].text).toContain('уже есть');
    });

    it('ignores non-/start messages', async () => {
      const prisma = fakePrisma();
      const sent: unknown[] = [];
      global.fetch = (async (...a: unknown[]) => {
        sent.push(a);
        return { ok: true } as Response;
      }) as typeof global.fetch;
      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        prisma as unknown as PrismaService,
      );
      await svc.handleUpdate({ update_id: 3, message: { text: 'hello', chat: { id: 42 } } });
      expect(sent).toHaveLength(0);
      expect(prisma.telegramKey.create).not.toHaveBeenCalled();
    });

    it('ignores updates without a message', async () => {
      const prisma = fakePrisma();
      const svc = new TelegramService(
        cfg({ TELEGRAM_BOT_TOKEN: 'T' }),
        prisma as unknown as PrismaService,
      );
      await expect(svc.handleUpdate({ update_id: 4 })).resolves.toBeUndefined();
    });
  });
});
