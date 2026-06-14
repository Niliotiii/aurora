import type { LlmService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';
import {
  QueryAnalysisSchema,
  getSystemPrompt,
  getUserPromptTemplate,
} from '../../prompts/v1/queryAnalyzer.ts';

/**
 * Classifies intent (data / out_of_scope / medical / injection) and detects a
 * genuinely ambiguous data question. Non-data intents and clarifications are routed
 * straight to the response node (no SQL is generated). (FR-007, FR-010, ambiguous edge)
 */
export function createQueryPlannerNode(llm: LlmService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      const { success, data } = await llm.generateStructured(
        getSystemPrompt(),
        getUserPromptTemplate(state.question!),
        QueryAnalysisSchema,
      );

      if (!success || !data) {
        // Fail safe: treat as a normal data question rather than leaking anything.
        console.log('⚠️  Intent analysis failed; defaulting to data.');
        return { intent: 'data' };
      }

      if (data.intent !== 'data') {
        console.log(`🛡️  Intent classified as ${data.intent} — routing to safe refusal.`);
        return { intent: data.intent, refusalReason: data.reasoning };
      }

      if (data.needsClarification && data.clarificationQuestion?.trim()) {
        console.log('❓ Ambiguous question — asking for clarification.');
        return { intent: 'data', clarification: data.clarificationQuestion.trim() };
      }

      return { intent: 'data' };
    } catch (error) {
      console.error('Error in planner:', error instanceof Error ? error.message : error);
      return { intent: 'data' };
    }
  };
}
