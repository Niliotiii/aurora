import type { LlmService } from '../../services/llmService.ts';
import { PostgresService } from '../../services/postgresService.ts';
import type { GraphState } from '../graph.ts';
import {
  SqlCorrectionSchema,
  getSystemPrompt,
  getUserPromptTemplate,
} from '../../prompts/v1/sqlCorrection.ts';
import { getGenerationContext } from '../../prompts/v1/whoContext.ts';

/** Bounded self-correction: fix a failed query once, then re-execute (FR-014). */
export function createSqlCorrectionNode(llm: LlmService, db: PostgresService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      console.log('🔧 Correcting SQL...');
      const context = await getGenerationContext(db);
      const { success, data, error } = await llm.generateStructured(
        getSystemPrompt(context),
        getUserPromptTemplate(state.query!, state.validationError!, state.question),
        SqlCorrectionSchema,
      );

      if (!success || !data?.correctedSql) {
        if (error) console.error('SQL correction failed:', error);
        return { error: 'Não foi possível corrigir a consulta.', needsCorrection: false };
      }

      console.log(`✅ Corrected: ${data.explanation}`);
      return {
        query: data.correctedSql,
        originalQuery: state.originalQuery ?? state.query,
        correctionAttempts: (state.correctionAttempts ?? 0) + 1,
        validationError: undefined,
        needsCorrection: false,
      };
    } catch (error) {
      console.error('Error correcting SQL:', error instanceof Error ? error.message : error);
      return { error: 'Não foi possível corrigir a consulta.', needsCorrection: false };
    }
  };
}
