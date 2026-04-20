import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';

/**
 * Ports the LLM-client half of `backend/app/services/gigachat.py`.
 * Provides a provider-agnostic `LlmService` that switches between GigaChat
 * (cloud.ru foundation-models) and NVIDIA NIM based on the `LLM_PROVIDER`
 * env var.
 */
@Module({
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
