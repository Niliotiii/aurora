import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent, providerStrategy } from 'langchain';
import type { z } from 'zod/v3';
import { config } from '../config.ts';
import type { LlmService, StructuredResult } from './llmService.ts';

/**
 * OpenRouter (OpenAI-compatible) implementation of {@link LlmService} for structured
 * (zod) generation. Mirrors repo-exemplo/src/services/openrouterService.ts.
 */
export class OpenRouterService implements LlmService {
  private llmClient: ChatOpenAI;

  constructor() {
    this.llmClient = new ChatOpenAI({
      apiKey: config.openrouter.apiKey,
      modelName: config.openrouter.model,
      temperature: config.llm.temperature,
      timeout: config.llm.requestTimeoutMs,
      maxRetries: config.llm.maxRetries,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': config.openrouter.httpReferer,
          'X-Title': config.openrouter.xTitle,
        },
      },
      modelKwargs: {
        models: [config.openrouter.model],
        provider: config.openrouter.provider,
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
      return {
        success: true,
        data: result.structuredResponse as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
