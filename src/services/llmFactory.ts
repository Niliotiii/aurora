import { type ProviderId, SUPPORTED_PROVIDERS, config } from '../config.ts';
import { AnthropicService } from './anthropicService.ts';
import type { LlmService } from './llmService.ts';
import { OpenAIService } from './openaiService.ts';
import { OpenRouterService } from './openrouterService.ts';

/** Env-var names per provider (used to build secret-free error messages). */
export const PROVIDER_ENV: Record<ProviderId, { keyEnv: string; modelEnv: string }> = {
  openrouter: { keyEnv: 'OPENROUTER_API_KEY', modelEnv: 'OPENROUTER_MODEL' },
  openai: { keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL' },
  anthropic: { keyEnv: 'ANTHROPIC_API_KEY', modelEnv: 'ANTHROPIC_MODEL' },
};

function credsFor(provider: ProviderId): { apiKey: string; model: string } {
  switch (provider) {
    case 'openai':
      return { apiKey: config.openai.apiKey, model: config.openai.model };
    case 'anthropic':
      return { apiKey: config.anthropic.apiKey, model: config.anthropic.model };
    default:
      return { apiKey: config.openrouter.apiKey, model: config.openrouter.model };
  }
}

/**
 * Fail-fast validation of the active provider selection (FR-006, contract F-2). Throws a
 * clear, SECRET-FREE error (names the env var, never the value) when the provider is
 * unsupported or its key/model is missing. Pure function so it is unit-testable (T020).
 */
export function assertValidProvider(
  provider: string,
  apiKey: string,
  model: string,
): asserts provider is ProviderId {
  if (!SUPPORTED_PROVIDERS.includes(provider as ProviderId)) {
    throw new Error(
      `Unsupported LLM_PROVIDER: "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}.`,
    );
  }
  const env = PROVIDER_ENV[provider as ProviderId];
  if (!apiKey?.trim()) {
    throw new Error(`Missing ${env.keyEnv}: required when LLM_PROVIDER=${provider}.`);
  }
  if (!model?.trim()) {
    throw new Error(`Missing ${env.modelEnv}: required when LLM_PROVIDER=${provider}.`);
  }
}

/**
 * Single point of provider selection. Validates the active provider fail-fast, then returns
 * the matching {@link LlmService}. Nodes and `graph/factory.ts` never branch on provider
 * (contract llm-service.md §2).
 */
export function createLlmService(): LlmService {
  const provider = config.llm.provider;
  const { apiKey, model } = credsFor(provider);
  assertValidProvider(provider, apiKey, model);

  switch (provider) {
    case 'openrouter':
      return new OpenRouterService();
    case 'openai':
      return new OpenAIService();
    case 'anthropic':
      return new AnthropicService();
  }
}

export type { ProviderId };
