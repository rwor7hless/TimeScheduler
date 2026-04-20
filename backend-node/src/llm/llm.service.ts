import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Ports `backend/app/services/gigachat.py` — a provider-agnostic
 * OpenAI-compatible LLM client. Despite the legacy filename, it supports
 * multiple providers:
 *
 *   - LLM_PROVIDER=gigachat → cloud.ru foundation-models (GigaChat)
 *   - LLM_PROVIDER=nvidia   → NVIDIA NIM (integrate.api.nvidia.com)
 *
 * Both providers implement `/v1/chat/completions`, so only base_url,
 * api_key and model name differ. Errors are mapped to plain `Error`
 * instances with Russian human-readable messages — call sites translate
 * them to HTTP 503.
 */

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  keyEnvName: string;
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const BASE_PARAMS = {
  temperature: 0.5,
  presence_penalty: 0,
  top_p: 0.95,
} as const;

// Non-stream: hard cap on whole request (short daily-tip style replies).
const SHORT_TIMEOUT_MS = 60_000;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {}

  resolveProvider(): ProviderConfig {
    const provider = (this.config.get<string>('LLM_PROVIDER') ?? 'gigachat').toLowerCase();
    if (provider === 'nvidia') {
      return {
        name: 'NVIDIA NIM',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: this.config.get<string>('NVIDIA_API_KEY') ?? '',
        model: this.config.get<string>('NVIDIA_MODEL') ?? '',
        keyEnvName: 'NVIDIA_API_KEY',
      };
    }
    return {
      name: 'GigaChat (cloud.ru)',
      baseUrl: 'https://foundation-models.api.cloud.ru/v1',
      apiKey: this.config.get<string>('GIGACHAT_API_KEY') ?? '',
      model: this.config.get<string>('GIGACHAT_MODEL') ?? '',
      keyEnvName: 'GIGACHAT_API_KEY',
    };
  }

  llmAvailable(): boolean {
    return Boolean(this.resolveProvider().apiKey);
  }

  llmUnavailableReason(): string | null {
    const cfg = this.resolveProvider();
    if (!cfg.apiKey) {
      return (
        `LLM отключён в конфигурации: задайте ${cfg.keyEnvName} в .env ` +
        `(текущий провайдер — ${cfg.name}).`
      );
    }
    return null;
  }

  llmInfo(): { provider: string; model: string; base_url: string } {
    const cfg = this.resolveProvider();
    return { provider: cfg.name, model: cfg.model, base_url: cfg.baseUrl };
  }

  private client(cfg: ProviderConfig, opts: { stream?: boolean } = {}): OpenAI {
    if (!cfg.apiKey) {
      throw new Error(`${cfg.keyEnvName} не задан в .env (провайдер: ${cfg.name})`);
    }
    return new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseUrl,
      // For streams: disable per-request timeout so httpx-style reads don't kill mid-generation.
      // For non-stream: match Python's 60s read cap.
      timeout: opts.stream ? 0 : SHORT_TIMEOUT_MS,
    });
  }

  private wrapError(exc: unknown): Error {
    if (exc instanceof OpenAI.RateLimitError) {
      return new Error('LLM перегружен (rate limit). Попробуйте через минуту.');
    }
    if (exc instanceof OpenAI.APIConnectionTimeoutError) {
      return new Error('LLM не ответил вовремя. Попробуйте ещё раз.');
    }
    if (exc instanceof OpenAI.APIConnectionError) {
      return new Error('Нет связи с LLM-сервисом. Проверьте интернет/настройки.');
    }
    if (exc instanceof OpenAI.APIUserAbortError) {
      return new Error('Запрос к LLM был прерван.');
    }
    if (exc instanceof OpenAI.APIError) {
      return new Error(`Ошибка LLM API: ${exc.message ?? exc}`);
    }
    const msg = exc instanceof Error ? exc.message : String(exc);
    return new Error(`Непредвиденная ошибка LLM: ${msg}`);
  }

  private promptChars(messages: ChatMessage[]): number {
    return messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
  }

  async chatCompletion(
    messages: ChatMessage[],
    opts: { maxTokens?: number } = {},
  ): Promise<string> {
    const cfg = this.resolveProvider();
    const client = this.client(cfg);
    const maxTokens = opts.maxTokens ?? 2500;
    this.logger.log(
      `LLM call: provider=${cfg.name} model=${cfg.model} messages=${messages.length} ` +
        `prompt_chars=${this.promptChars(messages)} max_tokens=${maxTokens}`,
    );
    const t0 = Date.now();
    let response;
    try {
      response = await client.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        model: cfg.model,
        ...BASE_PARAMS,
      });
    } catch (exc) {
      this.logger.warn(
        `LLM call failed after ${((Date.now() - t0) / 1000).toFixed(2)}s: ` +
          `provider=${cfg.name} model=${cfg.model} err=${String(exc)}`,
      );
      throw this.wrapError(exc);
    }

    if (!response.choices || response.choices.length === 0) {
      throw new Error('LLM вернул пустой ответ.');
    }
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('LLM вернул пустое содержимое.');
    }
    this.logger.log(
      `LLM call done in ${((Date.now() - t0) / 1000).toFixed(2)}s: ` +
        `provider=${cfg.name} model=${cfg.model} response_chars=${content.length}`,
    );
    return content;
  }

  async *streamChatCompletion(
    messages: ChatMessage[],
    opts: { maxTokens?: number } = {},
  ): AsyncGenerator<string> {
    const cfg = this.resolveProvider();
    const client = this.client(cfg, { stream: true });
    const maxTokens = opts.maxTokens ?? 4096;
    this.logger.log(
      `LLM stream call: provider=${cfg.name} model=${cfg.model} messages=${messages.length} ` +
        `prompt_chars=${this.promptChars(messages)} max_tokens=${maxTokens}`,
    );
    const t0 = Date.now();
    let stream;
    try {
      stream = await client.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        model: cfg.model,
        stream: true,
        ...BASE_PARAMS,
      });
    } catch (exc) {
      this.logger.warn(
        `LLM stream open failed after ${((Date.now() - t0) / 1000).toFixed(2)}s: ` +
          `provider=${cfg.name} model=${cfg.model} err=${String(exc)}`,
      );
      throw this.wrapError(exc);
    }

    try {
      for await (const chunk of stream) {
        if (!chunk.choices || chunk.choices.length === 0) {
          continue;
        }
        const content = chunk.choices[0].delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (exc) {
      this.logger.warn(
        `LLM stream broke mid-flight after ${((Date.now() - t0) / 1000).toFixed(2)}s: ` +
          `provider=${cfg.name} model=${cfg.model} err=${String(exc)}`,
      );
      throw this.wrapError(exc);
    }
  }
}
