import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, providerStrategy } from 'langchain';
import type { z } from 'zod/v3';
import { config } from '../config.ts';
import type { LlmService, StructuredResult } from './llmService.ts';

/**
 * Dedicated safety-classification LLM client. Always uses OpenRouter with
 * SAFEGUARD_MODEL, regardless of the active LLM_PROVIDER. maxRetries=0 so the
 * node fails fast and falls back to fail-open rather than retrying on timeout.
 */
export class SafeguardService implements LlmService {
  private llmClient: ChatOpenAI;

  constructor() {
    this.llmClient = new ChatOpenAI({
      apiKey: config.safeguard.apiKey,
      modelName: config.safeguard.model,
      temperature: 0,
      timeout: config.safeguard.requestTimeoutMs,
      maxRetries: config.safeguard.maxRetries,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': config.openrouter.httpReferer,
          'X-Title': config.openrouter.xTitle,
        },
      },
    });
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<StructuredResult<T>> {
    try {
      const agent = createAgent({
        model: this.llmClient,
        tools: [],
        responseFormat: providerStrategy(schema),
      });

      const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
      const result = await agent.invoke({ messages });
      return { success: true, data: result.structuredResponse as T };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
