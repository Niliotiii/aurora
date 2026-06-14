import { logSafeguardAudit } from '../../guards/audit.ts';
import {
  SafeguardSchema,
  getSystemPrompt,
  getUserPromptTemplate,
} from '../../prompts/v1/inputSafeguard.ts';
import type { LlmService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';

/**
 * Pre-pipeline safety screen (FR-001, Principle V). Runs before queryPlanner and
 * uses a dedicated safety model to classify the message. Fails open on model failure
 * so the queryPlanner's own intent classifier acts as the second line of defence.
 */
export function createInputSafeguardNode(llm: LlmService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    if (!state.question) return {};

    try {
      const { success, data } = await llm.generateStructured(
        getSystemPrompt(),
        getUserPromptTemplate(state.question),
        SafeguardSchema,
      );

      if (!success || !data) {
        console.warn('⚠️  Safeguard model failed — fail-open, passing to queryPlanner.');
        return {};
      }

      const { classification, reason } = data;

      if (classification === 'safe') {
        console.log('🛡️  Safeguard: safe — passing to queryPlanner.');
        return {};
      }

      const intent = classification === 'out_of_scope' ? 'out_of_scope' : 'injection';

      console.log(`🛡️  Safeguard: BLOCKED (${classification}) — routing to refusal.`);
      logSafeguardAudit({ decision: 'rejected', classification, reason });

      return { intent, refusalReason: reason };
    } catch (error) {
      console.warn(
        '⚠️  Safeguard error — fail-open:',
        error instanceof Error ? error.message : String(error),
      );
      return {};
    }
  };
}
