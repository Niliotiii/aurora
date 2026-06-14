// Aurora configuration — environment-driven.
// Multi-step decomposition from repo-exemplo is intentionally OUT OF SCOPE for this
// base (single-query pipeline only), so there is no `maxSubQuestions` here.

/** Supported LLM providers. Exactly one is active per deployment (see `llm.provider`). */
export type ProviderId = 'openrouter' | 'openai' | 'anthropic';

export const SUPPORTED_PROVIDERS: ProviderId[] = ['openrouter', 'openai', 'anthropic'];

// Shared, provider-agnostic knobs. Timeout/retries generalized to LLM_* with the older
// OPENROUTER_* names kept as a fallback for backward compatibility.
const requestTimeoutMs = Number(
  process.env.LLM_TIMEOUT_MS ?? process.env.OPENROUTER_TIMEOUT_MS ?? 30000,
);
const maxRetries = Number(process.env.LLM_MAX_RETRIES ?? process.env.OPENROUTER_MAX_RETRIES ?? 2);

export const config = {
  // Active provider selection (defaults to openrouter → backward compatible, FR-005).
  llm: {
    provider: (process.env.LLM_PROVIDER ?? 'openrouter') as ProviderId,
    temperature: 0.2,
    requestTimeoutMs,
    maxRetries,
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.OPENROUTER_MODEL ?? '',
    httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? '',
    xTitle: process.env.OPENROUTER_X_TITLE ?? 'Aurora',
    provider: {
      sort: {
        by: 'throughput',
        partition: 'none',
      },
    },
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? '',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? '',
  },

  // Privileged connection — used ONLY by data/seed.ts to create schema + roles + load data.
  postgresAdmin: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'aurora',
    user: process.env.PGUSER ?? 'aurora_admin',
    password: process.env.PGPASSWORD ?? 'postgres',
  },

  // Read-only connection — used by the app at request time (Principle IV).
  postgresReadOnly: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'aurora',
    user: process.env.PG_READONLY_USER ?? 'aurora_readonly',
    password: process.env.PG_READONLY_PASSWORD ?? 'readonly',
  },

  server: {
    port: Number(process.env.PORT ?? 4000),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },

  // Bounded self-correction (matches repo-exemplo's maxCorrectionAttempts).
  maxCorrectionAttempts: 1,

  // Default safety cap on result rows when a generated query has no LIMIT.
  defaultRowLimit: 1000,

  // The WHO source folder (relative to repo/container root).
  whoSourceDir: 'A4C49D3_3.2.2- Neonatal mortality rate',

  // Dedicated safety-classification model (always via OpenRouter, independent of LLM_PROVIDER).
  safeguard: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.SAFEGUARD_MODEL ?? 'openai/gpt-oss-safeguard-20b',
    requestTimeoutMs: Number(process.env.SAFEGUARD_TIMEOUT_MS ?? 5000),
    maxRetries: 0,
  },
};

export default config;
