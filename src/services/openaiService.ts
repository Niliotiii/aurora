import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, providerStrategy } from 'langchain';
import type { z } from 'zod/v3';
import { config } from '../config.ts';
import type { LlmService, StructuredResult } from './llmService.ts';

/**
 * OpenAI implementation of {@link LlmService}. Uses the same `ChatOpenAI` class as the
 * OpenRouter service but against the default OpenAI base URL (no OpenRouter headers/routing).
 */
export class OpenAIService implements LlmService {
  private llmClient: ChatOpenAI;

  constructor() {
    this.llmClient = new ChatOpenAI({
      apiKey: config.openai.apiKey,
      modelName: config.openai.model,
      temperature: config.llm.temperature,
      timeout: config.llm.requestTimeoutMs,
      maxRetries: config.llm.maxRetries,
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

      const result = await agent.invoke({
        messages: [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
      });
      return { success: true, data: result.structuredResponse as T };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
