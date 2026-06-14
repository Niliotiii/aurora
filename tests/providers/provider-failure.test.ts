import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HumanMessage } from '@langchain/core/messages';

import { buildAgentGraph } from '../../src/graph/graph.ts';
import type { LlmService, StructuredResult } from '../../src/services/llmService.ts';
import { leaksInternals } from '../helpers.ts';

// US3 / FR-008 / FR-010 / SC-005 / contract §4 T-6: when the provider fails (timeout, rate
// limit, malformed output → modeled here as generateStructured returning success:false), the
// user gets a SAFE Portuguese error and the request completes (no hang, no leak). Deterministic.

// A provider that always "fails" the way a timed-out/rate-limited provider would.
class FailingLlm implements LlmService {
  async generateStructured<T>(): Promise<StructuredResult<T>> {
    return { success: false, error: 'simulated provider timeout' };
  }
}

// Passthrough safeguard stub: always returns safe so the analytical FailingLlm is exercised.
class PassthroughSafeguardLlm implements LlmService {
  async generateStructured<T>(): Promise<StructuredResult<T>> {
    return {
      success: true,
      data: { classification: 'safe', reason: 'stub' } as T,
    };
  }
}

// Minimal Postgres stub; the generation-context calls hit getSchema/query before the LLM.
const dbStub = {
  async getSchema() {
    return 'stub schema';
  },
  async query() {
    return [];
  },
  async validateQuery() {
    return { ok: true };
  },
} as unknown as import('../../src/services/postgresService.ts').PostgresService;

test('provider failure yields a safe Portuguese answer, no hang, no leak', async () => {
  const graph = buildAgentGraph(new FailingLlm(), dbStub, new PassthroughSafeguardLlm());

  const state = await graph.invoke({
    messages: [new HumanMessage('Qual foi a taxa de mortalidade neonatal do Brasil em 1971?')],
  });

  assert.ok(state.answer && state.answer.length > 0, 'expected a non-empty safe answer');
  assert.equal(leaksInternals(state.answer!), false, 'safe error must not leak internals');
  // The raw provider error must not be surfaced to the user.
  assert.equal(
    state.answer!.includes('simulated provider timeout'),
    false,
    'raw provider error must not leak',
  );
  // Answer should be Portuguese (the safe messages are PT).
  assert.match(
    state.answer!,
    /não|consulta|solicitação|Desculpe/i,
    'expected a Portuguese safe message',
  );
});
