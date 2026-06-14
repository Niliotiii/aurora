// Data dictionary helpers — teach the model how the WHO star schema fits together
// and how coded dimension values map to readable labels (FR-013, Principle I).

export const INDICATOR = {
  uuid: 'A4C49D3',
  code: 'WHOSIS_000003',
  name: 'Neonatal mortality rate (per 1000 live births)',
  unit: 'deaths per 1000 live births',
  valueLabel: 'Number of deaths during the first 28 completed days of life per 1000 live births',
};

// Plain-language description of the tables and how to join them.
export const TABLE_NOTES = [
  'fact_observation: one measured WHO estimate. Columns: obs_id, ind_uuid, geo_code_m49, time_id, sex, age, rate_per_1000 (point estimate), rate_low (lower bound), rate_high (upper bound).',
  'indicator: the metric definition (ind_uuid, ind_code, name, short_name, unit). Only A4C49D3 / WHOSIS_000003 is present.',
  'dim_geography: geo_code_m49 (e.g. 076), geo_name_short (e.g. Brazil), geo_code_type (e.g. COUNTRY).',
  'dim_time: time_id, time_year (e.g. 2000), time_type (e.g. YEAR).',
  'dim_term: code-list lookup. term_set (DIM_SEX or DIM_AGE), term_key (e.g. TOTAL, D_LE27), term_name_main (human label).',
  'JOINS: fact_observation.geo_code_m49 = dim_geography.geo_code_m49 ; fact_observation.time_id = dim_time.time_id ; fact_observation.ind_uuid = indicator.ind_uuid.',
  "DIMENSION VALUES: fact_observation.sex and fact_observation.age store the human label directly (e.g. sex='Total', age='0 to 27 days'). To resolve a coded term from a user, map it via dim_term.term_name_main.",
  'The rate is per 1000 live births; lower values mean fewer neonatal deaths.',
].join('\n');

export interface TermRow {
  term_set: string;
  term_key: string;
  term_name_main: string;
}

/** Build a compact data-dictionary string from the live schema + code-list terms. */
export function formatDataDictionary(schema: string, terms: TermRow[]): string {
  const sexTerms = terms
    .filter((t) => t.term_set === 'DIM_SEX')
    .map((t) => `${t.term_key}=${t.term_name_main}`)
    .join(', ');
  const ageTerms = terms
    .filter((t) => t.term_set === 'DIM_AGE')
    .map((t) => `${t.term_key}=${t.term_name_main}`)
    .join(', ');

  return [
    '## Database schema (public)',
    schema,
    '',
    '## Table notes',
    TABLE_NOTES,
    '',
    '## Coded dimension values (code=label)',
    `DIM_SEX: ${sexTerms}`,
    `DIM_AGE: ${ageTerms}`,
  ].join('\n');
}
