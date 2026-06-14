import { createLlmService } from '../services/llmFactory.ts';
import { PostgresService } from '../services/postgresService.ts';
import { SafeguardService } from '../services/safeguardService.ts';
import { buildAgentGraph } from './graph.ts';

export function buildAuroraGraph() {
  const llm = createLlmService();
  const safeguardLlm = new SafeguardService();
  const db = new PostgresService();
  return {
    graph: buildAgentGraph(llm, db, safeguardLlm),
    llm,
    db,
  };
}
