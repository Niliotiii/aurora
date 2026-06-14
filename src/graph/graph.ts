import type { BaseMessage } from '@langchain/core/messages';
import { END, MessagesZodMeta, START, StateGraph } from '@langchain/langgraph';
import { withLangGraph } from '@langchain/langgraph/zod';
import { z } from 'zod/v3';

import type { LlmService } from '../services/llmService.ts';
import type { PostgresService } from '../services/postgresService.ts';

import { createAnalyticalResponseNode } from './nodes/analyticalResponseNode.ts';
import { createExtractQuestionNode } from './nodes/extractQuestionNode.ts';
import { createInputSafeguardNode } from './nodes/inputSafeguardNode.ts';
import { createQueryPlannerNode } from './nodes/queryPlannerNode.ts';
import { createSqlCorrectionNode } from './nodes/sqlCorrectionNode.ts';
import { createSqlExecutorNode } from './nodes/sqlExecutorNode.ts';
import { createSqlGeneratorNode } from './nodes/sqlGeneratorNode.ts';

export const AuroraStateAnnotation = z.object({
  // Input
  messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
  question: z.string().optional(),

  // Planning / intent classification (US3 routes non-data intents to a safe refusal)
  intent: z.enum(['data', 'out_of_scope', 'medical', 'injection']).optional(),
  refusalReason: z.string().optional(),
  clarification: z.string().optional(),

  // SQL generation + execution
  query: z.string().optional(),
  originalQuery: z.string().optional(),
  dbResults: z.array(z.any()).optional(),

  // Bounded self-correction
  correctionAttempts: z.number().optional(),
  validationError: z.string().optional(),
  needsCorrection: z.boolean().optional(),

  // Response
  answer: z.string().optional(),
  attribution: z.string().optional(),
  vegaSpec: z.any().optional(),
  followUpQuestions: z.array(z.string()).optional(),

  // Sanitized error (outward-safe)
  error: z.string().optional(),
});

export type GraphState = z.infer<typeof AuroraStateAnnotation>;

export function buildAgentGraph(llm: LlmService, db: PostgresService, safeguardLlm: LlmService) {
  const workflow = new StateGraph({ stateSchema: AuroraStateAnnotation })
    .addNode('extractQuestion', createExtractQuestionNode())
    .addNode('inputSafeguard', createInputSafeguardNode(safeguardLlm))
    .addNode('queryPlanner', createQueryPlannerNode(llm))
    .addNode('sqlGenerator', createSqlGeneratorNode(llm, db))
    .addNode('sqlExecutor', createSqlExecutorNode(db))
    .addNode('sqlCorrection', createSqlCorrectionNode(llm, db))
    .addNode('analyticalResponse', createAnalyticalResponseNode(llm))

    .addEdge(START, 'extractQuestion')

    .addConditionalEdges('extractQuestion', (state: GraphState) => {
      if (state.error) return 'analyticalResponse';
      return 'inputSafeguard';
    })

    // Safeguard blocks injection/out_of_scope/malicious before the analytical pipeline.
    .addConditionalEdges('inputSafeguard', (state: GraphState) => {
      if (state.intent && state.intent !== 'data') return 'analyticalResponse';
      return 'queryPlanner';
    })

    // Non-data intents (out-of-scope / medical / injection) skip SQL entirely.
    .addConditionalEdges('queryPlanner', (state: GraphState) => {
      if (state.intent && state.intent !== 'data') return 'analyticalResponse';
      if (state.clarification) return 'analyticalResponse';
      return 'sqlGenerator';
    })

    .addEdge('sqlGenerator', 'sqlExecutor')

    .addConditionalEdges('sqlExecutor', (state: GraphState) => {
      if (state.needsCorrection && (state.correctionAttempts ?? 0) < 1) {
        return 'sqlCorrection';
      }
      return 'analyticalResponse';
    })

    .addEdge('sqlCorrection', 'sqlExecutor')
    .addEdge('analyticalResponse', END);

  return workflow.compile();
}
