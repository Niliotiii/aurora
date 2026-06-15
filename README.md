# Aurora

Conversational **Text-to-SQL** agent over the **WHO Global Health Observatory** "Neonatal
mortality rate" dataset (indicator `A4C49D3` / `WHOSIS_000003`). Ask a question in plain
language; Aurora translates it to SQL, runs it against a **read-only** PostgreSQL database,
and returns a grounded answer plus an interactive **Vega-Lite** chart.

## Demo

<video src="video/out/aurora-demo.mp4" width="720" controls></video>

Built per the project [constitution](.specify/memory/constitution.md) (v1.1.0):
single source of truth, **zero medical hallucination**, mandatory WHO-estimate
attribution, **read-only** access in depth, and schema/prompt-injection protection.

## Architecture

Single **Node.js 24.11.1 + TypeScript** stack, structured after `./repo-exemplo`
(a Text-to-Cypher agent), reimplemented for relational SQL:

```
Question → extractQuestion → queryPlanner → sqlGenerator → sqlExecutor → analyticalResponse
                                  │                            │  ▲
              (out-of-scope / medical / injection)             └─ sqlCorrection (bounded, 1x)
                                  └──────────► safe refusal
```

- **Orchestration**: LangChain + **LangGraph** (`src/graph`)
- **LLM**: OpenRouter (`src/services/openrouterService.ts`)
- **DB**: PostgreSQL via a `SELECT`-only role (`src/services/postgresService.ts`)
- **Guards** (defense in depth): `src/guards/sqlGuard.ts` (blocks DML/DDL),
  `errorSanitizer.ts` (no leaks), `audit.ts` (query audit log)
- **Charts**: Vega-Lite spec built in `src/viz/vegaSpec.ts`
- **UI**: separate container — Vite + **React + Mantine** (`web/`), renders Vega-Lite via `react-vega`

## Quick start (Docker — recommended)

```bash
cp .env.example .env          # set OPENROUTER_API_KEY
docker compose up             # postgres + app (seeds on boot) + web
```

- API: http://localhost:4000  (`POST /chat`)
- Web UI: http://localhost:8080

A single `docker compose up` brings up Postgres (with healthcheck), the API (which waits
for the DB and **seeds the WHO data automatically**), and the web UI.

### LLM providers (OpenRouter / OpenAI / Anthropic)

Aurora can run on any of three providers, selected with a single env var. OpenRouter is the
default, so existing deployments keep working with no change.

```dotenv
LLM_PROVIDER=openrouter        # openrouter (default) | openai | anthropic

# Set the block for the provider you chose:
OPENROUTER_API_KEY=...   OPENROUTER_MODEL=anthropic/claude-sonnet-4-6
OPENAI_API_KEY=...       OPENAI_MODEL=gpt-5
ANTHROPIC_API_KEY=...    ANTHROPIC_MODEL=claude-sonnet-4-6

LLM_TIMEOUT_MS=30000           # uniform across providers (fail fast, not hang)
LLM_MAX_RETRIES=2
```

Switching providers is **config-only** (no code change). Misconfiguration (missing key/model,
unsupported provider) fails fast at startup with a clear, secret-free message. See
`specs/002-multi-llm-providers/quickstart.md` for details.

### Local (without Docker)

```bash
npm install
npm run docker:infra:up       # just Postgres
npm run seed                  # load the WHO CSVs + create the read-only role
npm run dev                   # API on :4000
cd web && npm install && npm run dev   # UI on :5173
```

## Example

```bash
curl -X POST -H 'Content-Type: application/json' \
  --data '{"question": "What was Brazil'\''s neonatal mortality rate in 2000?"}' \
  http://localhost:4000/chat
```

Returns `{ answer, attribution, vegaSpec, followUpQuestions, query }`. Every data-bearing
answer carries the WHO-estimate attribution.

## Tests

```bash
npm run test:e2e
```

Deterministic checks (SQL guard / mutation blocking, Vega-Lite spec) run anywhere. The
LLM+DB end-to-end tests (grounding, unavailable, injection, medical) run when
`OPENROUTER_API_KEY` and a seeded database are available, and skip otherwise.

## Data

Source CSVs live in `A4C49D3_3.2.2- Neonatal mortality rate/` and are loaded by
`data/seed.ts` into a star schema (`indicator`, `dim_geography`, `dim_time`, `dim_term`,
`fact_observation`). See `specs/001-text-to-sql-base/` for the full spec, plan, and tasks.
