# Implementation Plan: Multi-Provider LLM Compatibility (Anthropic & OpenAI)

**Branch**: `002-multi-llm-providers` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-multi-llm-providers/spec.md`

## Summary

Aurora today reaches its LLM exclusively through `OpenRouterService`, a thin wrapper over
LangChain's `ChatOpenAI` pointed at the OpenRouter base URL. This feature generalizes that
single client into a **provider-agnostic LLM layer** so an operator can select **OpenRouter**
(default, unchanged), **Anthropic**, or **OpenAI** through configuration, with every pipeline
step and every constitutional guarantee behaving identically regardless of the active provider.

Technical approach: introduce a small `LlmService` interface (the existing
`generateStructured(systemPrompt, userPrompt, schema)` contract), make the four model-backed
nodes depend on that interface instead of the concrete `OpenRouterService`, and add a provider
factory that constructs the correct LangChain chat model (`ChatOpenAI` for OpenRouter/OpenAI,
`ChatAnthropic` for Anthropic) behind it. Structured output continues to flow through
`createAgent({ model, responseFormat: providerStrategy(schema) })`, which already operates on
any `BaseChatModel`, so the abstraction is the underlying client + config selection, not the
generation logic. Configuration is resolved at startup with fail-fast validation; timeouts and
bounded retries (already added) apply uniformly across providers.

## Technical Context

**Language/Version**: Node.js 24.11.1, TypeScript (ESM, `"type": "module"`, native `.ts` execution)
**Primary Dependencies**: Existing — `langchain`, `@langchain/core`, `@langchain/openai`, `@langchain/langgraph`, `fastify`, `zod`. **New** — `@langchain/anthropic` (provides `ChatAnthropic`) for the Anthropic provider
**Storage**: PostgreSQL 16 via the read-only role (unchanged; not affected by this feature)
**Testing**: Node.js built-in test runner (`node --test`); deterministic tests run anywhere, LLM+DB e2e tests run when a provider key + seeded DB are present and skip otherwise
**Target Platform**: Docker Compose (`postgres` + `app` + `web`); provider selected via environment variables passed to the `app` container
**Project Type**: Web application (Node/TS backend API + TS/JS web UI). This feature is backend-only — no UI change required
**Performance Goals**: Interactive single-user usage; per-question latency dominated by the chosen provider; uniform request timeout (default 30s) bounds worst case
**Constraints**: Read-only DB (Principle IV); mandatory WHO attribution (III); no schema/secret leakage (V); zero medical/causal claims (II); single source of truth (I). All MUST hold identically for every provider. Backward compatibility: default provider remains OpenRouter (FR-005, SC-006)
**Scale/Scope**: 3 supported providers, one active per deployment; ~4 model-backed pipeline nodes; one new interface + one provider factory + config additions + new Anthropic client wrapper

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Derived from `.specify/memory/constitution.md` v1.1.0:

| Principle | Gate | Plan compliance |
|-----------|------|-----------------|
| I. Single Source of Truth (WHO GHO) | Figures only from the WHO dataset | ✅ Unaffected — provider change does not alter the data dictionary injection or DB grounding; all providers receive the same grounding context |
| II. Zero Medical Hallucination | Analyst only; refusals enforced | ✅ Same prompts (`prompts/v1/*`) across providers; refusal/medical paths unchanged; parity verified by reused guardrail e2e tests per provider |
| III. Mandatory Data Transparency | WHO attribution on every data answer | ✅ Attribution appended in code (`analyticalResponseNode`), provider-independent; unchanged |
| IV. Read-Only Database Access | SELECT-only role + app-layer guard | ✅ Unaffected — query execution path and `sqlGuard` unchanged; no provider can bypass the guard |
| V. Schema Protection & Prompt-Injection Resistance | No schema/secret leakage; safe errors | ✅ Provider API keys handled only via env/config; `errorSanitizer` returns safe Portuguese errors for provider failures; keys never logged or returned (FR-007) |
| Tech constraints | Node/TS; LangChain+LangGraph; PostgreSQL read-only; Vega-Lite | ✅ Stays within mandated stack; adds `@langchain/anthropic` (same LangChain family) — no new runtime, no Python |

**Security gate** (changes touch query-generation paths): the existing guardrail e2e suite
(mutation block, injection refusal, medical refusal, schema non-disclosure) MUST pass under
each provider. **Transparency gate**: attribution presence test MUST pass under each provider.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-llm-providers/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — provider integration decisions
├── data-model.md        # Phase 1 output — config/provider entities (no DB change)
├── quickstart.md        # Phase 1 output — how to configure each provider
├── contracts/
│   └── llm-service.md   # The provider-agnostic LlmService contract + config contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (already created by /speckit.specify)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── config.ts                       # ADD: provider selection + per-provider key/model resolution
├── graph/
│   ├── factory.ts                  # CHANGE: build LLM via provider factory (not new OpenRouterService)
│   └── nodes/
│       ├── queryPlannerNode.ts     # CHANGE: depend on LlmService interface (type only)
│       ├── sqlGeneratorNode.ts     # CHANGE: depend on LlmService interface (type only)
│       ├── sqlCorrectionNode.ts    # CHANGE: depend on LlmService interface (type only)
│       └── analyticalResponseNode.ts # CHANGE: depend on LlmService interface (type only)
└── services/
    ├── llmService.ts               # NEW: LlmService interface + StructuredResult (shared type)
    ├── llmFactory.ts               # NEW: select + construct the active provider client
    ├── openrouterService.ts        # KEEP: implements LlmService (OpenRouter via ChatOpenAI + base URL)
    ├── openaiService.ts            # NEW: implements LlmService (OpenAI via ChatOpenAI, no base URL)
    └── anthropicService.ts         # NEW: implements LlmService (Anthropic via ChatAnthropic)

tests/
├── helpers.ts                      # CHANGE: allow selecting provider for live e2e via env
└── providers/
    └── provider-parity.e2e.test.ts # NEW: run core guardrail/attribution checks per active provider

.env.example                        # CHANGE: document LLM_PROVIDER + Anthropic/OpenAI keys & models
docker-compose.yaml                 # CHANGE: pass new provider env vars through to the app service
package.json                        # CHANGE: add @langchain/anthropic dependency
```

**Structure Decision**: Keep the existing single Node/TS backend layout. The change is a
focused refactor of the `services/` layer: extract a tiny `LlmService` interface that the
existing `OpenRouterService` already satisfies, add two sibling implementations
(`openaiService`, `anthropicService`), and a `llmFactory` that reads config and returns the
active one. Nodes already import `OpenRouterService` only as a **type** for their `llm`
parameter, so switching them to the interface is a low-risk type change with no behavioral
edit. No UI, DB, prompt, or guard changes are required.

## Complexity Tracking

> No constitution violations — section intentionally left empty.
