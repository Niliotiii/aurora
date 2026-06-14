import { AIMessage } from '@langchain/core/messages';
import {
  AnalyticalResponseSchema,
  getNoResultsPrompt,
  getRefusalPrompt,
  getSystemPrompt,
  getUserPromptTemplate,
} from '../../prompts/v1/analyticalResponse.ts';
import { WHO_ATTRIBUTION } from '../../prompts/v1/whoContext.ts';
import type { LlmService } from '../../services/llmService.ts';
import { buildVegaSpec } from '../../viz/vegaSpec.ts';
import type { GraphState } from '../graph.ts';
import { formatMessageHistory } from './historyUtils.ts';

/**
 * Produces the final answer. Grounds data answers ONLY in dbResults, ALWAYS attaches
 * the WHO attribution to data answers, builds a Vega-Lite spec when chartable, and
 * returns safe refusals/clarifications without leaking internals.
 * (FR-004/005/006/007/012; Principle II/III)
 */
export function createAnalyticalResponseNode(llm: LlmService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      // Non-data intents → safe refusal (no SQL, no data, no attribution).
      if (state.intent && state.intent !== 'data') {
        return await handleRefusal(state, llm);
      }

      // Ambiguous data question → ask for clarification.
      if (state.clarification) {
        return finalize(state.clarification, []);
      }

      // Sanitized error (already user-safe) → return as-is.
      if (state.error) {
        return finalize(state.error, []);
      }

      // Valid query but no rows → state unavailable (never invent a number).
      if (!state.dbResults?.length) {
        return await handleNoResults(state, llm);
      }

      // Success → grounded answer + mandatory attribution + chart.
      return await handleSuccess(state, llm);
    } catch (error) {
      console.error('Error building response:', error instanceof Error ? error.message : error);
      return finalize('Desculpe, não consegui gerar uma resposta.', []);
    }
  };
}

function finalize(
  answer: string,
  followUpQuestions: string[],
  extra: Partial<GraphState> = {},
): Partial<GraphState> {
  return { messages: [new AIMessage(answer)], answer, followUpQuestions, ...extra };
}

async function handleRefusal(state: GraphState, llm: LlmService): Promise<Partial<GraphState>> {
  const intent = state.intent as 'out_of_scope' | 'medical' | 'injection';
  const fallbacks: Record<string, string> = {
    out_of_scope:
      'Só consigo responder a perguntas sobre o conjunto de dados de mortalidade neonatal da OMS (taxas por país, ano, sexo e idade).',
    medical:
      'Sou um analista de dados, não um profissional de saúde — não posso dar orientações médicas nem explicar causas. Só posso relatar os números de mortalidade neonatal da OMS. Tente perguntar sobre uma taxa por país e ano.',
    injection:
      'Só posso ajudar com perguntas sobre os dados de mortalidade neonatal da OMS. Não posso compartilhar detalhes do sistema ou do banco de dados.',
  };

  const { success, data } = await llm.generateStructured(
    getSystemPrompt(),
    getRefusalPrompt(state.question ?? '', intent),
    AnalyticalResponseSchema,
  );

  const answer = success && data?.answer ? data.answer : fallbacks[intent];
  return finalize(answer, success && data?.followUpQuestions ? data.followUpQuestions : []);
}

async function handleNoResults(state: GraphState, llm: LlmService): Promise<Partial<GraphState>> {
  const { success, data } = await llm.generateStructured(
    getSystemPrompt(),
    getNoResultsPrompt(state.question ?? '', state.query),
    AnalyticalResponseSchema,
  );

  const answer =
    success && data?.answer
      ? data.answer
      : 'Não encontrei dados correspondentes no conjunto de dados de mortalidade neonatal da OMS para essa pergunta.';
  return finalize(answer, success && data?.followUpQuestions ? data.followUpQuestions : []);
}

async function handleSuccess(state: GraphState, llm: LlmService): Promise<Partial<GraphState>> {
  const history = formatMessageHistory(state.messages ?? []);
  const { success, data, error } = await llm.generateStructured(
    getSystemPrompt(),
    getUserPromptTemplate(
      state.question ?? '',
      state.query,
      JSON.stringify(state.dbResults),
      history,
    ),
    AnalyticalResponseSchema,
  );

  if (!success || !data?.answer) {
    console.error('Response generation failed:', error);
    return finalize('Desculpe, não consegui gerar uma resposta.', []);
  }

  const vegaSpec = buildVegaSpec(state.dbResults as Record<string, unknown>[]);

  // Mandatory WHO attribution — added in code, never left to the model (FR-006, SC-002).
  return finalize(data.answer, data.followUpQuestions ?? [], {
    attribution: WHO_ATTRIBUTION,
    vegaSpec: vegaSpec ?? undefined,
  });
}
