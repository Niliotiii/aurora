import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveEnvAvailable, ask, leaksInternals } from './helpers.ts';

// US1 / SC-001 / SC-002: a known question returns a grounded answer WITH attribution.
// Requires a live LLM + seeded DB; skipped otherwise.

test(
  'Brazil known-year question is grounded and attributed',
  { skip: !liveEnvAvailable() },
  async () => {
    const state = await ask("What was Brazil's neonatal mortality rate in 1971?");

    assert.ok(state.answer && state.answer.length > 0, 'expected a non-empty answer');
    assert.ok(
      state.attribution && /WHO/i.test(state.attribution),
      'expected WHO attribution (SC-002)',
    );
    assert.match(state.answer!, /\d/, 'expected a numeric figure in the answer');
    assert.ok(
      state.query && /^\s*SELECT|^\s*WITH/i.test(state.query),
      'expected an executed SELECT',
    );
    assert.equal(leaksInternals(state.answer!), false, 'answer must not leak internals');
  },
);
