# Implementation Plan: Text-to-SQL Conversational Agent — Initial Base

**Branch**: `001-text-to-sql-base` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-text-to-sql-base/spec.md`

## Summary

Build the end-to-end base of Aurora: a conversational agent that turns natural-language
questions about WHO neonatal mortality data into SQL, executes that SQL against a
read-only PostgreSQL database, and returns a grounded written answer plus an interactive
Vega-Lite chart. The architecture mirrors the staged, graph-orchestrated pipeline of the
reference project `./repo-exemplo` (a Text-to-Cypher/Neo4j agent), reimplemented for
relational SQL: question intake → query planning → SQL generation → safe execution
(with bounded self-correction) → analytical response/visualization. Per the planning
decision, the entire stack is **Node.js 24.11.1 + TypeScript** (Streamlit dropped; the
UI is a TypeScript/JavaScript web app), orchestrated with **LangChain + LangGraph**, with
**OpenRouter** as the LLM provider and **Vega-Lite** for charts.

## Technical Context

**Language/Version**: Node.js 24.11.1, TypeScript (ESM, `"type": "module"`, native `.ts` execution via `node --experimental-strip-types` as in the reference repo)  
**Primary Dependencies**: Backend — `@langchain/langgraph`, `langchain`, `@langchain/core`, `@langchain/openai` (OpenRouter via OpenAI-compatible base URL), `pg` (node-postgres), `fastify` + `@fastify/cors` (HTTP API), `zod` (schemas/structured output). Frontend (`web/`) — Vite + React + `@mantine/core`/`@mantine/hooks` (UI component library), `react-vega` + `vega`/`vega-lite`/`vega-embed` (interactive charts)  
**Storage**: PostgreSQL 16 (Docker), star schema seeded from the WHO CSV files; application connects exclusively through a `SELECT`-only role  
**Testing**: Node.js built-in test runner (`node --test`), with e2e tests mirroring `repo-exemplo/tests/*.e2e.test.ts`  
**Target Platform**: Docker Compose — three services (`postgres`, `app` API, `web` UI) brought up with a single `docker compose up`; the `app` waits for Postgres health and seeds automatically on boot; the `web` UI runs in its own container and calls the API over HTTP (CORS enabled)  
**Project Type**: Web application (Node/TS backend API + lightweight TS/JS web UI)  
**Performance Goals**: Interactive single-user usage; a typical question answered (LLM + query + response) within a few seconds; dataset is small (tens–low thousands of rows)  
**Constraints**: Read-only DB access (Principle IV); mandatory WHO-estimate attribution (Principle III); no schema/secret leakage (Principle V); zero medical/causal claims (Principle II); bounded self-correction (max 1 retry, as in the reference `maxCorrectionAttempts`)  
**Scale/Scope**: Single indicator (`A4C49D3` / `WHOSIS_000003`); single-user local deployment; ~5 pipeline nodes, ~3 dimension tables + 1 fact table

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Derived from `.specify/memory/constitution.md` v1.1.0:

| Principle | Gate | Plan compliance |
|-----------|------|-----------------|
| I. Single Source of Truth (WHO GHO) | All figures come only from the WHO dataset; no external/recalled stats | ✅ DB seeded solely from `A4C49D3_3.2.2- Neonatal mortality rate/` CSVs; generator restricted to that schema; data dictionary injected from the code list/metadata |
| II. Zero Medical Hallucination | Analyst only; no advice/diagnosis/invented causes | ✅ `analyticalResponse` prompt constrained to describe returned rows only; out-of-scope/medical requests refused |
| III. Mandatory Data Transparency | WHO-estimate attribution on every data-bearing response | ✅ Attribution appended by the response node and surfaced in the UI/chart; cannot be suppressed |
| IV. Read-Only Database Access | SELECT-only role + app-layer mutation blocking + logged rejections | ✅ Read-only Postgres role (primary control) **and** a SQL guard rejecting DROP/DELETE/UPDATE/INSERT/ALTER before execution, with audit logging |
| V. Schema Protection & Prompt-Injection Resistance | No schema/secret leakage; resist injection; safe errors | ✅ Injection-resistant system prompts; error sanitizer strips schema/stack/connection details; secrets only in env, never in responses |
| Tech constraints | Node.js 24.11.1 + TS; TS/JS web UI; LangChain+LangGraph; PostgreSQL read-only; Vega/Vega-Lite | ✅ Stack matches amended constitution exactly |

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-text-to-sql-base/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── chat-api.md      # HTTP API contract (POST /chat)
│   └── graph-state.md   # Pipeline state contract (LangGraph state)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created here)
```

### Source Code (repository root)

```text
src/
├── index.ts                 # App entrypoint (starts Fastify server)
├── server.ts                # Fastify app; POST /chat endpoint
├── config.ts                # Env-driven config (OpenRouter, Postgres, limits)
├── graph/
│   ├── factory.ts           # Wires services + builds compiled graph
│   ├── graph.ts             # LangGraph StateGraph definition + GraphState
│   └── nodes/
│       ├── extractQuestionNode.ts     # Pull question from messages
│       ├── queryPlannerNode.ts        # Plan / decompose question
│       ├── sqlGeneratorNode.ts        # NL → SQL (uses data dictionary)
│       ├── sqlExecutorNode.ts         # Guarded read-only execution
│       ├── sqlCorrectionNode.ts       # Bounded self-correction
│       └── analyticalResponseNode.ts  # Grounded answer + WHO attribution + chart spec
├── services/
│   ├── openrouterService.ts # LLM client (OpenRouter, structured output via zod)
│   └── postgresService.ts   # node-postgres pool (read-only); schema + query
├── guards/
│   ├── sqlGuard.ts          # Block DROP/DELETE/UPDATE/INSERT/ALTER; SELECT-only
│   └── errorSanitizer.ts    # Strip schema/secrets/stack from user-facing errors
├── prompts/v1/
│   ├── sqlGenerator.ts      # System/user prompts + CypherQuery-equiv SQL schema
│   ├── sqlCorrection.ts
│   ├── queryAnalyzer.ts
│   ├── analyticalResponse.ts
│   └── whoContext.ts        # Domain context + data dictionary injection
└── viz/
    └── vegaSpec.ts          # Build Vega-Lite spec from result rows

web/                         # Vite + React + Mantine (UI component library, per constitution)
├── index.html               # Vite entry
├── src/                     # React app: chat (AppShell/ScrollArea/TextInput/Loader),
│                            #   renders Vega-Lite via react-vega/vega-embed; calls API via HTTP/CORS
└── Dockerfile               # Separate UI container image (vite build → static, served by nginx)

Dockerfile                   # app (API) image: seed-then-start entrypoint on boot

data/
├── seed.ts                  # Load WHO CSVs → Postgres star schema
├── schema.sql               # DDL for fact + dimension tables + read-only role
└── dictionary.ts            # Build data dictionary from code list + metadata

db/
└── source/                  # (reference) copy/symlink of WHO CSVs for seeding

tests/
└── textToSql.e2e.test.ts    # End-to-end pipeline tests (grounding, guards, attribution)

docker-compose.yaml          # 3 services: postgres (healthcheck) + app (depends_on healthy, seeds on boot) + web
package.json / tsconfig.json # Node 24 + TS config (mirrors repo-exemplo)
```

**Structure Decision**: Web application (Option 2), collapsed to a single Node/TS
codebase with a thin `web/` UI — chosen because the reference `repo-exemplo` is a single
Node/TS service and the planning decision keeps one runtime. The backend holds the
LangGraph pipeline, services, and guards; `web/` is a minimal TS/JS client that calls
`POST /chat` and renders the returned Vega-Lite spec. The WHO source CSVs live under the
existing `A4C49D3_3.2.2- Neonatal mortality rate/` folder and are loaded by `data/seed.ts`.

## Complexity Tracking

> No constitution violations — section intentionally left empty.
