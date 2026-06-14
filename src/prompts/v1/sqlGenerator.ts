import { z } from 'zod/v3';

export const SqlQuerySchema = z.object({
  sql: z.string().describe('A single read-only PostgreSQL SELECT statement'),
  rationale: z.string().describe('One short sentence on how the query answers the question'),
});

export type SqlQueryData = z.infer<typeof SqlQuerySchema>;

export const getSystemPrompt = (context: string): string => {
  return JSON.stringify({
    role: 'PostgreSQL Text-to-SQL generator for the WHO neonatal mortality dataset',
    context,
    rules: [
      'Output exactly ONE statement and it MUST be a SELECT (read-only).',
      'NEVER produce DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, GRANT or multiple statements.',
      'Only reference the public tables in the schema; never system catalogs (pg_*, information_schema).',
      'Use explicit JOINs to resolve dimensions (geography, time) into readable labels.',
      'Always alias output columns with readable names (e.g. geo_name_short AS country, time_year AS year, rate_per_1000 AS rate).',
      'When returning a time series, include the year and ORDER BY year.',
      'Include rate_low and rate_high when reporting a rate, so uncertainty can be shown.',
      'Add a LIMIT when the result could be large.',
      'Return ONLY the raw SQL in the `sql` field (no markdown, no comments).',
    ],
    examples: [
      {
        question: "What was Brazil's neonatal mortality rate in 2000?",
        sql: "SELECT g.geo_name_short AS country, t.time_year AS year, f.rate_per_1000 AS rate, f.rate_low, f.rate_high FROM fact_observation f JOIN dim_geography g ON f.geo_code_m49 = g.geo_code_m49 JOIN dim_time t ON f.time_id = t.time_id WHERE g.geo_name_short = 'Brazil' AND t.time_year = 2000",
      },
      {
        question: 'Show the trend of neonatal mortality in Brazil over the years',
        sql: "SELECT t.time_year AS year, f.rate_per_1000 AS rate, f.rate_low, f.rate_high FROM fact_observation f JOIN dim_geography g ON f.geo_code_m49 = g.geo_code_m49 JOIN dim_time t ON f.time_id = t.time_id WHERE g.geo_name_short = 'Brazil' ORDER BY t.time_year",
      },
    ],
  });
};

export const getUserPromptTemplate = (question: string): string => question;
