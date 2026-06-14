import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAnalyticalResponseNode } from '../../src/graph/nodes/analyticalResponseNode.ts';
import { createQueryPlannerNode } from '../../src/graph/nodes/queryPlannerNode.ts';
import { createSqlCorrectionNode } from '../../src/graph/nodes/sqlCorrectionNode.ts';
import { createSqlGeneratorNode } from '../../src/graph/nodes/sqlGeneratorNode.ts';
import type { LlmService, StructuredResult } from '../../src/services/llmService.ts';

// FR-002 / contract §U2: every model-backed node MUST use the single injected LlmService
// instance — no node may bypass it or construct its own provider.

class RecordingLlm implements LlmService {
  public calls = 0;
  async generateStructured<T>(): Promise<StructuredResult<T>> {
    this.calls++;
    return { success: false, error: 'stub' };
  }
}

// Minimal Postgres stub for the two nodes that build a generation context.
const dbStub = {
  async getSchema() {
    return 'stub schema';
  },
  async query() {
    return [];
  },
} as unknown as import('../../src/services/postgresService.ts').PostgresService;

test('all four model-backed nodes call the same injected LlmService (FR-002)', async () => {
  const llm = new RecordingLlm();

  await createQueryPlannerNode(llm)({ question: 'q' } as never);
  assert.equal(llm.calls, 1, 'queryPlanner should use the injected LlmService');

  await createSqlGeneratorNode(llm, dbStub)({ question: 'q' } as never);
  assert.equal(llm.calls, 2, 'sqlGenerator should use the injected LlmService');

  await createSqlCorrectionNode(
    llm,
    dbStub,
  )({
    question: 'q',
    query: 'SELECT 1',
    validationError: 'boom',
  } as never);
  assert.equal(llm.calls, 3, 'sqlCorrection should use the injected LlmService');

  // No dbResults → handleNoResults path, which still calls the LLM.
  await createAnalyticalResponseNode(llm)({ question: 'q' } as never);
  assert.equal(llm.calls, 4, 'analyticalResponse should use the injected LlmService');
});
