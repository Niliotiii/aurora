import type { LlmService } from '../../services/llmService.ts';
import { PostgresService } from '../../services/postgresService.ts';
import type { GraphState } from '../graph.ts';
import {
  SqlQuerySchema,
  getSystemPrompt,
  getUserPromptTemplate,
} from '../../prompts/v1/sqlGenerator.ts';
import { getGenerationContext } from '../../prompts/v1/whoContext.ts';

/** NL → single SELECT, grounded by the injected schema + data dictionary (FR-002, FR-013). */
export function createSqlGeneratorNode(llm: LlmService, db: PostgresService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      console.log('🤖 Generating SQL...');
      const context = await getGenerationContext(db);
      const { success, data, error } = await llm.generateStructured(
        getSystemPrompt(context),
        getUserPromptTemplate(state.question!),
        SqlQuerySchema,
      );

      if (!success || !data?.sql) {
        if (error) console.error('SQL generation failed:', error);
        return { error: 'Não foi possível gerar uma consulta.' };
      }

      console.log(`🧮 SQL: ${data.sql}`);
      return { query: data.sql };
    } catch (error) {
      console.error('Error generating SQL:', error instanceof Error ? error.message : error);
      return { error: 'Não foi possível gerar uma consulta.' };
    }
  };
}
