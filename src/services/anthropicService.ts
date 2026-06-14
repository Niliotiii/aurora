import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent, providerStrategy } from 'langchain';
import type { z } from 'zod/v3';
import { config } from '../config.ts';
import type { LlmService, StructuredResult } from './llmService.ts';

/**
 * Anthropic implementation of {@link LlmService} using LangChain's `ChatAnthropic`.
 * Reuses the same `createAgent` + `providerStrategy` structured-output pattern as the other
 * providers. The T017 probe validates structured output works on Anthropic; if not, swap
 * `providerStrategy(schema)` for `this.llmClient.withStructuredOutput(schema)` (research R1).
 */
export class AnthropicService implements LlmService {
  private llmClient: ChatAnthropic;

  constructor() {
    this.llmClient = new ChatAnthropic({
      apiKey: config.anthropic.apiKey,
      model: config.anthropic.model,
      temperature: config.llm.temperature,
      maxRetries: config.llm.maxRetries,
      // Anthropic requires an explicit max_tokens; leave room for structured output.
      maxTokens: 4096,
      clientOptions: { timeout: config.llm.requestTimeoutMs },
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
