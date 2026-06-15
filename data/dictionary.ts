// Data dictionary — teaches the LLM the MORT_200 star schema (FR-013, Principle I).

export const INDICATOR = {
  code: 'MORT_200',
  name: 'Deaths per 1,000 live births',
  unit: 'mortes por 1.000 nascidos vivos',
};

export const TABLE_NOTES = [
  'fact_observation: uma estimativa da OMS. Colunas: fact_id, geo_code, time_year, age_code, cause_code, rate_per_1000.',
  'dim_geography: geo_code (ISO alpha-3, ex: BRA), geo_name (ex: Brazil), region_code (ex: AMR), region_name (ex: Americas).',
  'dim_time: time_year (SMALLINT, 2000–2017).',
  'dim_age_group: age_code, age_name (ex: "0-27 days"), age_label (ex: "Neonatal (0-27 dias)").',
  'dim_cause: cause_code, cause_name. Use cause_code = \'ALL_CAUSES\' para total geral (soma de todas as causas). Outras causas: CHILDCAUSE_CH10 (Prematuridade), CHILDCAUSE_CH11 (Asfixia), CHILDCAUSE_CH12 (Sepse), CHILDCAUSE_CH13 (Outras infecciosas), CHILDCAUSE_CH15 (Anomalias congênitas), CHILDCAUSE_CH2 (HIV/AIDS), CHILDCAUSE_CH3 (Diarreia), CHILDCAUSE_CH5 (Tétano), CHILDCAUSE_CH6 (Sarampo), CHILDCAUSE_CH7 (Meningite), CHILDCAUSE_CH8 (Malária), CHILDCAUSE_CH9 (IVAS), CHILDCAUSE_CH16 (Outras DCNT), CHILDCAUSE_CH17 (Lesões).',
  'JOINS: fact_observation JOIN dim_geography ON geo_code; JOIN dim_time ON time_year; JOIN dim_age_group ON age_code; JOIN dim_cause ON cause_code.',
  'age_code VALUES: AGEGROUP_DAYS0-27 = neonatal (0-27 dias); AGEGROUP_MONTHS1-59 = pós-neonatal (1-59 meses); AGEGROUP_YEARS0-4 = abaixo de 5 anos (0-4 anos).',
  'REGRA IMPORTANTE: para taxa total por país/ano/faixa, filtre cause_code = \'ALL_CAUSES\'. Para análise por causa específica, use o cause_code correspondente e exclua ALL_CAUSES.',
  'A taxa é por 1.000 nascidos vivos. Menor valor = menos mortes.',
].join('\n');

/** Schema string injected into the LLM system prompt. */
export function formatDataDictionary(): string {
  return [
    '## Esquema do banco (public)',
    '',
    'dim_geography(geo_code PK, geo_name, region_code, region_name)',
    'dim_time(time_year PK)',
    'dim_age_group(age_code PK, age_name, age_label)',
    'dim_cause(cause_code PK, cause_name)',
    'fact_observation(fact_id PK, geo_code FK, time_year FK, age_code FK, cause_code FK, rate_per_1000)',
    '',
    '## Notas das tabelas',
    TABLE_NOTES,
  ].join('\n');
}
