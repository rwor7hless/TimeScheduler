import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Ports `backend/app/services/ntfy.py` — simple push via ntfy.sh.
 *
 * Phase 7 stub: just a POST with headers. Phase 9 may extend for
 * per-topic auth or markdown-formatted messages.
 */

export interface NtfySendOptions {
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
  clickUrl?: string;
}

export interface NtfySendResult {
  ok: boolean;
  topic?: string;
  server?: string;
  error?: string;
}

@Injectable()
export class NtfyService {
  private readonly logger = new Logger(NtfyService.name);

  constructor(private readonly config: ConfigService) {}

  async send(title: string, message: string, opts: NtfySendOptions = {}): Promise<NtfySendResult> {
    const topic = this.config.get<string>('NTFY_TOPIC') ?? '';
    const server = this.config.get<string>('NTFY_SERVER') ?? 'https://ntfy.sh';

    if (!topic) {
      return { ok: false, error: 'NTFY_TOPIC не задан в .env' };
    }

    const url = `${server.replace(/\/+$/, '')}/${topic}`;
    const headers: Record<string, string> = {
      Title: title,
      Priority: opts.priority ?? 'default',
      'Content-Type': 'text/plain; charset=utf-8',
    };
    if (opts.tags && opts.tags.length > 0) {
      headers.Tags = opts.tags.join(',');
    }
    if (opts.clickUrl) {
      headers.Click = opts.clickUrl;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: message,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        this.logger.warn(`ntfy failed ${resp.status}: ${body}`);
        return { ok: false, error: `ntfy: HTTP ${resp.status}` };
      }
      this.logger.log(`ntfy: sent '${title}' → ${url}`);
      return { ok: true, topic, server };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`ntfy: failed to send '${title}': ${msg}`);
      return { ok: false, error: msg };
    }
  }
}
