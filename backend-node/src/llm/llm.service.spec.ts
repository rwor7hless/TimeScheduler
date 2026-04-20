import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (k: string) => values[k],
  } as unknown as ConfigService;
}

describe('LlmService', () => {
  it('resolveProvider defaults to gigachat', () => {
    const svc = new LlmService(makeConfig({ GIGACHAT_API_KEY: 'k', GIGACHAT_MODEL: 'GigaChat' }));
    const cfg = svc.resolveProvider();
    expect(cfg.name).toBe('GigaChat (cloud.ru)');
    expect(cfg.baseUrl).toBe('https://foundation-models.api.cloud.ru/v1');
    expect(cfg.apiKey).toBe('k');
    expect(cfg.keyEnvName).toBe('GIGACHAT_API_KEY');
  });

  it('resolveProvider switches to nvidia on LLM_PROVIDER=nvidia', () => {
    const svc = new LlmService(
      makeConfig({ LLM_PROVIDER: 'nvidia', NVIDIA_API_KEY: 'n', NVIDIA_MODEL: 'meta/llama' }),
    );
    const cfg = svc.resolveProvider();
    expect(cfg.name).toBe('NVIDIA NIM');
    expect(cfg.baseUrl).toBe('https://integrate.api.nvidia.com/v1');
    expect(cfg.apiKey).toBe('n');
    expect(cfg.keyEnvName).toBe('NVIDIA_API_KEY');
  });

  it('llmAvailable reflects key presence', () => {
    const absent = new LlmService(makeConfig({}));
    expect(absent.llmAvailable()).toBe(false);
    const present = new LlmService(makeConfig({ GIGACHAT_API_KEY: 'k' }));
    expect(present.llmAvailable()).toBe(true);
  });

  it('llmUnavailableReason returns Russian message when key is missing', () => {
    const svc = new LlmService(makeConfig({}));
    const reason = svc.llmUnavailableReason();
    expect(reason).toContain('LLM отключён');
    expect(reason).toContain('GIGACHAT_API_KEY');
    expect(reason).toContain('GigaChat');
  });

  it('llmUnavailableReason returns null when key is set', () => {
    const svc = new LlmService(makeConfig({ GIGACHAT_API_KEY: 'x' }));
    expect(svc.llmUnavailableReason()).toBeNull();
  });

  it('llmInfo surfaces provider/model/base_url', () => {
    const svc = new LlmService(makeConfig({ GIGACHAT_API_KEY: 'k', GIGACHAT_MODEL: 'M' }));
    const info = svc.llmInfo();
    expect(info.provider).toBe('GigaChat (cloud.ru)');
    expect(info.model).toBe('M');
    expect(info.base_url).toContain('cloud.ru');
  });

  it('case-insensitive LLM_PROVIDER', () => {
    const svc = new LlmService(makeConfig({ LLM_PROVIDER: 'NVIDIA', NVIDIA_API_KEY: 'n' }));
    expect(svc.resolveProvider().name).toBe('NVIDIA NIM');
  });
});
