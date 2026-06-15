// Build a Vega-Lite spec from result rows. Time series → line, categorical → bar,
// single scalar / not chartable → null.
// Field detection uses both name matching (fast path) and value-based heuristics
// (fallback) so the chart works even when the LLM uses unexpected column aliases.

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

function isYearValue(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1900 && n <= 2100;
}

// Fallback: find a column whose values look like years (integers in 1900–2100).
function findYearKeyByValue(rows: Row[]): string | null {
  const sample = rows[0];
  for (const key of Object.keys(sample)) {
    if (rows.every((r) => isYearValue(r[key]))) return key;
  }
  return null;
}

// Fallback: find a numeric column that isn't year-like and has positive values.
function findRateKeyByValue(rows: Row[], excludeKey: string | null): string | null {
  const sample = rows[0];
  for (const key of Object.keys(sample)) {
    if (key === excludeKey) continue;
    if (rows.every((r) => isNumeric(r[key]) && !isYearValue(r[key]) && Number(r[key]) >= 0)) {
      return key;
    }
  }
  return null;
}

// Fallback: find a string column that could be a categorical label.
function findLabelKeyByValue(rows: Row[], excludeKeys: (string | null)[]): string | null {
  const sample = rows[0];
  for (const key of Object.keys(sample)) {
    if (excludeKeys.includes(key)) continue;
    if (typeof sample[key] === 'string') return key;
  }
  return null;
}

export function buildVegaSpec(rows: Row[] | undefined): object | null {
  if (!rows || rows.length < 2) return null;

  const sample = rows[0];

  // Name-based detection (fast path from SQL aliases).
  let yearKey = findKey(sample, YEAR_KEYS);
  let rateKey = findKey(sample, RATE_KEYS);
  let labelKey = findKey(sample, LABEL_KEYS);

  // Value-based fallback when name detection misses.
  if (!yearKey) yearKey = findYearKeyByValue(rows);
  if (!rateKey) rateKey = findRateKeyByValue(rows, yearKey);
  if (!labelKey) labelKey = findLabelKeyByValue(rows, [yearKey, rateKey]);

  if (!rateKey || !isNumeric(sample[rateKey])) return null;

  const base = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: rows },
    width: 480,
    height: 260,
  };

  // Time series → line chart over years.
  if (yearKey && isNumeric(sample[yearKey])) {
    return {
      ...base,
      title: 'Taxa de mortalidade neonatal ao longo do tempo (estimativas OMS)',
      mark: { type: 'line', point: true },
      encoding: {
        x: { field: yearKey, type: 'ordinal', title: 'Ano' },
        y: { field: rateKey, type: 'quantitative', title: 'Taxa por 1.000 nascidos vivos' },
        ...(labelKey ? { color: { field: labelKey, type: 'nominal', title: 'Categoria' } } : {}),
        tooltip: [
          ...(labelKey ? [{ field: labelKey, type: 'nominal', title: 'Categoria' }] : []),
          { field: yearKey, type: 'ordinal', title: 'Ano' },
          { field: rateKey, type: 'quantitative', title: 'Taxa' },
        ],
      },
    };
  }

  // Categorical comparison → bar chart.
  if (labelKey) {
    return {
      ...base,
      title: 'Comparação de taxa de mortalidade neonatal (estimativas OMS)',
      mark: 'bar',
      encoding: {
        x: { field: labelKey, type: 'nominal', title: 'Categoria' },
        y: { field: rateKey, type: 'quantitative', title: 'Taxa por 1.000 nascidos vivos' },
        tooltip: [
          { field: labelKey, type: 'nominal', title: 'Categoria' },
          { field: rateKey, type: 'quantitative', title: 'Taxa' },
        ],
      },
    };
  }

  return null;
}
