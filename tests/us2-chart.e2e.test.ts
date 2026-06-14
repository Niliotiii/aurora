import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVegaSpec } from '../src/viz/vegaSpec.ts';

// FR-012 / SC-008: chartable results → Vega-Lite spec; single scalar → null.
// Deterministic (no DB/LLM).

test('single scalar row → null (text only)', () => {
  const spec = buildVegaSpec([{ country: 'Brazil', year: 2000, rate: 19.6 }]);
  assert.equal(spec, null);
});

test('empty results → null', () => {
  assert.equal(buildVegaSpec([]), null);
  assert.equal(buildVegaSpec(undefined), null);
});

test('time series → line chart', () => {
  const rows = [
    { year: 1998, rate: 22.1 },
    { year: 1999, rate: 21.0 },
    { year: 2000, rate: 19.6 },
  ];
  const spec = buildVegaSpec(rows) as any;
  assert.ok(spec, 'expected a spec');
  assert.equal(spec.mark.type ?? spec.mark, 'line');
  assert.equal(spec.encoding.x.field, 'year');
  assert.equal(spec.encoding.y.field, 'rate');
});

test('categorical comparison → bar chart', () => {
  const rows = [
    { country: 'Brazil', rate: 19.6 },
    { country: 'Chile', rate: 5.4 },
  ];
  const spec = buildVegaSpec(rows) as any;
  assert.ok(spec, 'expected a spec');
  assert.equal(spec.mark, 'bar');
  assert.equal(spec.encoding.x.field, 'country');
});
