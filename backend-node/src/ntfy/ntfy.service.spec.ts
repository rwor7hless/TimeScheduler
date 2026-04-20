import { ConfigService } from '@nestjs/config';
import { NtfyService } from './ntfy.service';

function cfg(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('NtfyService', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
  });

  it('returns ok=false when NTFY_TOPIC is empty', async () => {
    const svc = new NtfyService(cfg({}));
    const result = await svc.send('t', 'm');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('NTFY_TOPIC');
  });

  it('POSTs to server/topic and returns ok=true on success', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    global.fetch = (async (url: string, init?: RequestInit) => {
      seen.url = url;
      seen.init = init;
      return { ok: true, status: 200, text: async () => '' } as unknown as Response;
    }) as typeof global.fetch;
    const svc = new NtfyService(cfg({ NTFY_TOPIC: 'topic', NTFY_SERVER: 'https://ntfy.sh' }));
    const result = await svc.send('Hello', 'world', { priority: 'high', tags: ['a', 'b'] });
    expect(result).toEqual({ ok: true, topic: 'topic', server: 'https://ntfy.sh' });
    expect(seen.url).toBe('https://ntfy.sh/topic');
    expect((seen.init?.headers as Record<string, string>).Title).toBe('Hello');
    expect((seen.init?.headers as Record<string, string>).Priority).toBe('high');
    expect((seen.init?.headers as Record<string, string>).Tags).toBe('a,b');
  });

  it('handles fetch errors gracefully', async () => {
    global.fetch = (async () => {
      throw new Error('boom');
    }) as typeof global.fetch;
    const svc = new NtfyService(cfg({ NTFY_TOPIC: 'topic' }));
    const result = await svc.send('t', 'm');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('handles non-2xx responses as ok=false', async () => {
    global.fetch = (async () =>
      ({
        ok: false,
        status: 500,
        text: async () => 'server err',
      }) as Response) as typeof global.fetch;
    const svc = new NtfyService(cfg({ NTFY_TOPIC: 'topic' }));
    const result = await svc.send('t', 'm');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('500');
  });

  it('trims trailing slashes from server', async () => {
    let seenUrl = '';
    global.fetch = (async (url: string) => {
      seenUrl = url;
      return { ok: true, status: 200, text: async () => '' } as Response;
    }) as typeof global.fetch;
    const svc = new NtfyService(cfg({ NTFY_TOPIC: 'T', NTFY_SERVER: 'https://x.com///' }));
    await svc.send('t', 'm');
    expect(seenUrl).toBe('https://x.com/T');
  });
});
