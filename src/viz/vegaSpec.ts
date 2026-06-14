// Build a Vega-Lite spec from result rows. Time series → line, categorical → bar,
// single scalar / not chartable → null (FR-012).

type Row = Record<string, unknown>;

const YEAR_KEYS = ['year', 'time_year', 'ano'];
const RATE_KEYS = ['rate', 'rate_per_1000', 'value'];
const LABEL_KEYS = ['country', 'geo_name_short', 'sex', 'age', 'category'];

function findKey(row: Row, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const hit = keys.find((k) => k.toLowerCase() === c);
    if (hit) return hit;
  }
  return null;
}

function isNumeric(v: unknown): boolean {
  return v !== null && v !== undefined && !Number.isNaN(Number(v));
}

export function buildVegaSpec(rows: Row[] | undefined): object | null {
  if (!rows || rows.length < 2) return null; // single scalar / empty → text only

  const sample = rows[0];
  const yearKey = findKey(sample, YEAR_KEYS);
  const rateKey = findKey(sample, RATE_KEYS);
  const labelKey = findKey(sample, LABEL_KEYS);

  if (!rateKey || !isNumeric(sample[rateKey])) return null;

  const base = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: rows },
    width: 'container',
    height: 280,
  };

  // Time series → line chart over years.
  if (yearKey && isNumeric(sample[yearKey])) {
    return {
      ...base,
      title: 'Neonatal mortality rate over time (WHO estimates)',
      mark: { type: 'line', point: true },
      encoding: {
        x: { field: yearKey, type: 'temporal', title: 'Year' },
        y: { field: rateKey, type: 'quantitative', title: 'Rate per 1,000 live births' },
        ...(labelKey ? { color: { field: labelKey, type: 'nominal' } } : {}),
        tooltip: [
          ...(labelKey ? [{ field: labelKey, type: 'nominal' }] : []),
          { field: yearKey, type: 'temporal', title: 'Year' },
          { field: rateKey, type: 'quantitative', title: 'Rate' },
        ],
      },
    };
  }

  // Categorical comparison → bar chart.
  if (labelKey) {
    return {
      ...base,
      title: 'Neonatal mortality rate comparison (WHO estimates)',
      mark: 'bar',
      encoding: {
        x: { field: labelKey, type: 'nominal', title: labelKey },
        y: { field: rateKey, type: 'quantitative', title: 'Rate per 1,000 live births' },
        tooltip: [
          { field: labelKey, type: 'nominal' },
          { field: rateKey, type: 'quantitative', title: 'Rate' },
        ],
      },
    };
  }

  return null;
}
