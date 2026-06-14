import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadOnly, applyRowLimit } from '../src/guards/sqlGuard.ts';

// SC-003 / FR-008: mutating statements must be blocked before execution. These checks
// are deterministic (no DB/LLM needed) and run everywhere.

const MUTATIONS = [
  'DROP TABLE fact_observation',
  'DELETE FROM fact_observation',
  'UPDATE fact_observation SET rate_per_1000 = 0',
  'INSERT INTO fact_observation (obs_id) VALUES (1)',
  'ALTER TABLE fact_observation ADD COLUMN x int',
  'TRUNCATE fact_observation',
  'GRANT ALL ON fact_observation TO public',
  'SELECT 1; DROP TABLE indicator', // multi-statement
  'SELECT 1 /* sneaky */ ; DELETE FROM indicator', // comment-hidden + multi
];

for (const sql of MUTATIONS) {
  test(`blocks: ${sql.slice(0, 40)}`, () => {
    const result = assertReadOnly(sql);
    assert.equal(result.ok, false, `expected block for: ${sql}`);
  });
}

test('allows a plain SELECT', () => {
  const r = assertReadOnly('SELECT rate_per_1000 FROM fact_observation WHERE time_id = 1');
  assert.equal(r.ok, true);
});

test('allows a WITH (CTE) SELECT', () => {
  const r = assertReadOnly('WITH x AS (SELECT 1 AS n) SELECT n FROM x');
  assert.equal(r.ok, true);
});

test('applyRowLimit adds a LIMIT when missing', () => {
  const out = applyRowLimit('SELECT * FROM fact_observation', 1000);
  assert.match(out, /LIMIT 1000/);
});

test('applyRowLimit keeps an existing LIMIT', () => {
  const out = applyRowLimit('SELECT * FROM fact_observation LIMIT 5', 1000);
  assert.equal(out, 'SELECT * FROM fact_observation LIMIT 5');
});
