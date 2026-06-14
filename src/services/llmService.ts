import type { z } from 'zod/v3';

/**
 * Provider-agnostic structured-generation contract. Every LLM provider (OpenRouter,
 * OpenAI, Anthropic) implements this so the pipeline nodes never depend on a concrete
 * provider. Implementations MUST NOT throw to the caller — failures are returned as
 * `{ success: false, error }` (contract llm-service.md §1, C-1).
 */
export type StructuredResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: string };

export interface LlmService {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<StructuredResult<T>>;
}
