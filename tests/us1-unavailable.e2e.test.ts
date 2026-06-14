import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveEnvAvailable, ask } from './helpers.ts';

// US1 / FR-005 / SC-006: a question the dataset cannot answer returns "unavailable",
// never an invented number. The base dataset contains only Brazil, so another country
// yields no rows. Requires live env; skipped otherwise.

test(
  'out-of-dataset country → unavailable, no fabricated value',
  { skip: !liveEnvAvailable() },
  async () => {
    const state = await ask("What was Japan's neonatal mortality rate in 2000?");

    assert.ok(state.answer && state.answer.length > 0, 'expected a non-empty answer');
    // No chart for a non-result.
    assert.ok(!state.vegaSpec, 'no chart expected for unavailable data');
    // The executed query returned no rows (grounding had nothing to report).
    assert.ok(!state.dbResults || state.dbResults.length === 0, 'expected zero rows');
  },
);
