import { z } from 'zod/v3';

export const SqlQuerySchema = z.object({
  sql: z.string().describe('A single read-only PostgreSQL SELECT statement'),
  rationale: z.string().describe('One short sentence on how the query answers the question'),
});

export type SqlQueryData = z.infer<typeof SqlQuerySchema>;

export const getSystemPrompt = (context: string): string => {
  return JSON.stringify({
    role: 'PostgreSQL Text-to-SQL generator for the WHO MORT_200 infant mortality dataset',
    context,
    rules: [
      'Output exactly ONE statement and it MUST be a SELECT (read-only).',
      'NEVER produce DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, GRANT or multiple statements.',
      'Only reference the public tables in the schema; never system catalogs (pg_*, information_schema).',
      'Use explicit JOINs to resolve dimensions (geography, time, age group, cause) into readable labels.',
      'Always alias output columns with readable names (e.g. geo_name AS country, time_year AS year, rate_per_1000 AS rate).',
      "DEFAULT: filter cause_code = 'ALL_CAUSES' unless the user explicitly asks about a specific cause of death.",
      "DEFAULT age group: use age_code = 'AGEGROUP_DAYS0-27' (neonatal, 0-27 days) unless user specifies another age group.",
      "For under-5 mortality, use age_code = 'AGEGROUP_YEARS0-4'.",
      "For post-neonatal (1-59 months), use age_code = 'AGEGROUP_MONTHS1-59'.",
      'When returning a time series, include the year and ORDER BY year.',
      'Add a LIMIT when the result could be large.',
      'Return ONLY the raw SQL in the `sql` field (no markdown, no comments).',
    ],
    examples: [
      {
        question: 'Qual a taxa de mortalidade neonatal do Brasil em 2010?',
        sql: "SELECT g.geo_name AS country, f.time_year AS year, f.rate_per_1000 AS rate FROM fact_observation f JOIN dim_geography g ON f.geo_code = g.geo_code WHERE g.geo_name = 'Brazil' AND f.time_year = 2010 AND f.age_code = 'AGEGROUP_DAYS0-27' AND f.cause_code = 'ALL_CAUSES'",
      },
      {
        question: 'Evolução da mortalidade neonatal do Brasil entre 2000 e 2017',
        sql: "SELECT f.time_year AS year, f.rate_per_1000 AS rate FROM fact_observation f JOIN dim_geography g ON f.geo_code = g.geo_code WHERE g.geo_name = 'Brazil' AND f.age_code = 'AGEGROUP_DAYS0-27' AND f.cause_code = 'ALL_CAUSES' ORDER BY f.time_year",
      },
      {
        question: 'Quais os 10 países com maior mortalidade neonatal em 2015?',
        sql: "SELECT g.geo_name AS country, f.rate_per_1000 AS rate FROM fact_observation f JOIN dim_geography g ON f.geo_code = g.geo_code WHERE f.time_year = 2015 AND f.age_code = 'AGEGROUP_DAYS0-27' AND f.cause_code = 'ALL_CAUSES' ORDER BY f.rate_per_1000 DESC LIMIT 10",
      },
      {
        question: 'Mortalidade por prematuridade no Brasil em 2015',
        sql: "SELECT g.geo_name AS country, f.time_year AS year, c.cause_name AS cause, f.rate_per_1000 AS rate FROM fact_observation f JOIN dim_geography g ON f.geo_code = g.geo_code JOIN dim_cause c ON f.cause_code = c.cause_code WHERE g.geo_name = 'Brazil' AND f.time_year = 2015 AND f.age_code = 'AGEGROUP_DAYS0-27' AND f.cause_code = 'CHILDCAUSE_CH10'",
      },
      {
        question: 'Comparar mortalidade neonatal por causa no Brasil em 2017',
        sql: "SELECT c.cause_name AS cause, f.rate_per_1000 AS rate FROM fact_observation f JOIN dim_geography g ON f.geo_code = g.geo_code JOIN dim_cause c ON f.cause_code = c.cause_code WHERE g.geo_name = 'Brazil' AND f.time_year = 2017 AND f.age_code = 'AGEGROUP_DAYS0-27' AND f.cause_code != 'ALL_CAUSES' ORDER BY f.rate_per_1000 DESC",
      },
      {
        question: 'Quais as cinco maiores causas de mortalidade neonatal no Brasil em 2017?',
        sql: "SELECT c.cause_name AS cause, f.rate_per_1000 AS rate FROM fact_observation f JOIN dim_geography g ON f.geo_code = g.geo_code JOIN dim_cause c ON f.cause_code = c.cause_code WHERE g.geo_name = 'Brazil' AND f.time_year = 2017 AND f.age_code = 'AGEGROUP_DAYS0-27' AND f.cause_code != 'ALL_CAUSES' ORDER BY f.rate_per_1000 DESC LIMIT 5",
      },
    ],
  });
};

export const getUserPromptTemplate = (question: string, history?: string): string => {
  if (!history) return question;
  return `[Histórico da conversa — resolva referências como "essa taxa", "aquele país", "nos anos seguintes"]\n${history}\n\n[Pergunta atual]\n${question}`;
};
