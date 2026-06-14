# Phase 0 Research: Text-to-SQL Conversational Agent — Initial Base

**Feature**: `001-text-to-sql-base` | **Date**: 2026-06-10

All open decisions from the spec/plan were resolved (runtime + LLM provider chosen
interactively). No `NEEDS CLARIFICATION` markers remain.

## D1. Runtime / language stack

- **Decision**: Single **Node.js 24.11.1 + TypeScript** stack end to end, mirroring the
  reference `./repo-exemplo`. The UI is a lightweight TypeScript/JavaScript web client.
- **Rationale**: The constitution originally paired Node.js with Streamlit (Python),
  which cannot coexist in one runtime. The user chose a single Node/TS stack; the
  constitution was amended (v1.0.0 → v1.1.0) to replace "Streamlit" with a "TypeScript/
  JavaScript web UI". One runtime reduces operational complexity and stays closest to
  the reference project.
- **Alternatives considered**: (a) Split Node backend + Streamlit Python UI — rejected
  as two runtimes for a base feature; (b) All-Python (Streamlit + LangChain Python) —
  rejected because it discards Node.js 24.11.1.

## D2. LLM provider

- **Decision**: **OpenRouter** via the OpenAI-compatible client (`@langchain/openai`
  `ChatOpenAI` with `baseURL: https://openrouter.ai/api/v1`), exactly as in
  `repo-exemplo/src/services/openrouterService.ts`.
- **Rationale**: Reuses the proven reference pattern (single API key, model routing,
  structured output via `createAgent` + `providerStrategy(zodSchema)`); lets the model be
  swapped via config without code changes.
- **Alternatives considered**: Anthropic Claude or OpenAI direct — viable, but OpenRouter
  keeps parity with the example and provider flexibility.

## D3. Relational schema for the WHO dataset

- **Decision**: Model the GHO data as a small **star schema** — one fact table
  (`fact_observation`) plus dimension tables (`dim_geography`, `dim_time`,
  `dim_term` for coded sex/age) and an `indicator` table from the metadata file.
- **Rationale**: The dataset CSV already has fact columns
  (`RATE_PER_1000_N/NL/NU`) plus geography/time/sex/age dimensions; the code list maps
  dimension codes to readable names. A star schema makes generated SQL predictable and
  lets the data dictionary teach the model how to join codes to labels (Principle I, FR-013).
- **Alternatives considered**: A single flat table — simpler to seed but weakens the
  "cross-reference codes with dimension tables" requirement and the dictionary story.

## D4. Read-only enforcement (defense in depth, Principle IV)

- **Decision**: Two independent controls. (1) **Database role**: the app connects with a
  role granted only `SELECT` on the public schema. (2) **Application SQL guard**
  (`guards/sqlGuard.ts`): parse/normalize the generated statement, allow only a single
  `SELECT` (reject multiple statements, comments hiding DML, and any
  `DROP/DELETE/UPDATE/INSERT/ALTER/TRUNCATE/GRANT/...`), and log every rejection.
- **Rationale**: The reference repo validates queries with `EXPLAIN`; we extend that with
  an explicit deny-list + single-statement allow-list and a read-only role so neither a
  prompt-injected query nor a generator mistake can mutate data (FR-008, FR-009, SC-003).
- **Alternatives considered**: Role-only — rejected (no app-layer audit/logging);
  guard-only — rejected (a misconfigured role would be the only thing standing).

## D5. SQL validation before execution

- **Decision**: Validate generated SQL with `EXPLAIN <query>` (no rows touched) before
  running it, as the reference does with Cypher; on failure, route to a bounded
  self-correction node (`maxCorrectionAttempts = 1`, matching the reference config).
- **Rationale**: Catches syntax/column errors cheaply and feeds the error back to the
  corrector (FR-014); the cap prevents infinite loops.
- **Alternatives considered**: Unbounded retries — rejected (cost/latency, loop risk).

## D6. Structured LLM output

- **Decision**: Use `zod` schemas with the reference's `createAgent` +
  `providerStrategy(schema)` pattern to get typed objects (e.g., `{ sql, rationale }`,
  `{ answer, followUpQuestions }`) instead of parsing free text.
- **Rationale**: Deterministic extraction of the SQL and of the final answer; less
  brittle than regex parsing; mirrors `openrouterService.generateStructured`.
- **Alternatives considered**: Free-text + regex — rejected as fragile.

## D7. Mandatory WHO-estimate attribution (Principle III)

- **Decision**: The `analyticalResponseNode` always appends a fixed attribution string
  to any data-bearing answer, and the API returns an `attribution` field the UI renders
  alongside text and charts. It is added in code, not left to the model to remember.
- **Rationale**: Guarantees 100% coverage (SC-002) and prevents suppression on terse
  requests (FR-006).
- **Alternatives considered**: Prompt-only instruction — rejected (model may omit it).

## D8. Schema/secret protection & error sanitization (Principle V)

- **Decision**: System prompts include explicit anti-injection instructions; an
  `errorSanitizer` maps internal errors to safe user messages (no table names, no stack,
  no connection strings); secrets live only in environment variables.
- **Rationale**: Satisfies FR-010/FR-011 and SC-004 without leaking internals even under
  adversarial prompts.
- **Alternatives considered**: Returning raw DB errors — rejected (leaks schema).

## D9. Visualization (Vega-Lite)

- **Decision**: Build a **Vega-Lite** spec server-side in `viz/vegaSpec.ts` from the
  result rows (time series → line; categorical comparison → bar; single scalar → text,
  no chart); the web UI renders it with the Vega/Vega-Lite runtime.
- **Rationale**: Vega-Lite is concise for the chart types this dataset produces and meets
  FR-012/SC-008; keeping spec-building server-side keeps the UI thin.
- **Alternatives considered**: Full Vega specs — more verbose than needed for this scope.

## D10. Seeding the WHO source data

- **Decision**: A `data/seed.ts` script reads the three CSVs in
  `A4C49D3_3.2.2- Neonatal mortality rate/`, creates the schema (`data/schema.sql`),
  loads dimensions + facts, and builds the data dictionary (`data/dictionary.ts`) from
  the code list + metadata. Re-runnable (idempotent: drop/recreate or upsert).
- **Rationale**: Repeatable load (FR-016) and a fast local setup (SC-007); mirrors the
  reference `data/seed.ts` approach.
- **Alternatives considered**: Manual SQL import — rejected (not repeatable/testable).
