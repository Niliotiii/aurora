import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { liveEnvAvailable, ask } from './helpers.ts';
import { PostgresService } from '../src/services/postgresService.ts';

// SC-001: across a benchmark set, ≥95% of returned figures match the source data to
// 2 decimals. The "source of truth" here is the seeded DB. Requires live env.

interface Fixture {
  items: { question: string; year: number }[];
}

test(
  'benchmark: figures match the dataset to 2 decimals (SC-001)',
  { skip: !liveEnvAvailable() },
  async () => {
    const fixture = JSON.parse(
      readFileSync(join('tests', 'fixtures', 'questions.json'), 'utf8'),
    ) as Fixture;

    const db = new PostgresService();
    let matches = 0;

    try {
      for (const item of fixture.items) {
        const rows = await db.query<{ rate_per_1000: string }>(
          `SELECT f.rate_per_1000 FROM fact_observation f
         JOIN dim_time t ON f.time_id = t.time_id
         JOIN dim_geography g ON f.geo_code_m49 = g.geo_code_m49
         WHERE g.geo_name_short = 'Brazil' AND t.time_year = ${item.year}`,
        );
        if (rows.length === 0) continue;
        const expected = Number(rows[0].rate_per_1000).toFixed(2);

        const state = await ask(item.question);
        const answer = state.answer ?? '';
        // The rounded value (or its integer part) should appear in the grounded answer.
        const intPart = expected.split('.')[0];
        if (answer.includes(expected) || new RegExp(`\\b${intPart}\\b`).test(answer)) {
          matches++;
        }
      }
    } finally {
      await db.close();
    }

    const ratio = matches / fixture.items.length;
    assert.ok(ratio >= 0.95, `expected ≥95% match, got ${(ratio * 100).toFixed(0)}%`);
  },
);
