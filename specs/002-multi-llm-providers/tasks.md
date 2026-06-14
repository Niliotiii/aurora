---
description: "Task list for Multi-Provider LLM Compatibility (Anthropic & OpenAI)"
---

# Tasks: Multi-Provider LLM Compatibility (Anthropic & OpenAI)

**Input**: Design documents from `/specs/002-multi-llm-providers/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/llm-service.md

**Tests**: INCLUDED. The constitution mandates security gates (mutation rejection, injection
refusal, schema/secret non-disclosure) for any change touching query-generation paths, and the
spec/contract require provider-parity verification (SC-002, contract §4 T-1…T-6).

**Organization**: Tasks are grouped by user story so each can be implemented and verified
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3 — maps to the user stories in spec.md

## Path Conventions

Single Node/TS backend at repository root: source in `src/`, tests in `tests/`. Paths below are
exact and match the structure in plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring in the new dependency and surface the new configuration surface.

- [X] T001 Add `@langchain/anthropic` (version compatible with `@langchain/core` ^1.x) to dependencies in `package.json`
- [X] T002 [P] Document new provider configuration in `.env.example`: `LLM_PROVIDER` (default `openrouter`), `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES`
- [X] T003 [P] Pass the new provider env vars through to the `app` service in `docker-compose.yaml` (`LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Introduce the provider-agnostic abstraction so the pipeline no longer depends on a
concrete provider. **No user story can be completed until this phase is done.**

**⚠️ CRITICAL**: Blocks all user stories.

- [X] T004 Create `LlmService` interface and the shared `StructuredResult<T>` type in `src/services/llmService.ts` (matches contract §1)
- [X] T005 Refactor `src/services/openrouterService.ts` to `implements LlmService` and import `StructuredResult` from `src/services/llmService.ts` (no behavior change)
- [X] T006 Extend `src/config.ts` to resolve a `ProviderConfig` (read `LLM_PROVIDER` defaulting to `openrouter`; expose active `apiKey`/`model` per provider; generalize timeout/retries to `LLM_TIMEOUT_MS`/`LLM_MAX_RETRIES` with `OPENROUTER_TIMEOUT_MS`/`OPENROUTER_MAX_RETRIES` as fallback)
- [X] T007 Create the provider factory `createLlmService(cfg)` in `src/services/llmFactory.ts` with the `openrouter` branch wired (other branches added in US1); single point of provider selection (contract §2)
- [X] T008 [P] Change `src/graph/nodes/queryPlannerNode.ts` to type its `llm` parameter as `LlmService` (import from `src/services/llmService.ts`)
- [X] T009 [P] Change `src/graph/nodes/sqlGeneratorNode.ts` to type its `llm` parameter as `LlmService`
- [X] T010 [P] Change `src/graph/nodes/sqlCorrectionNode.ts` to type its `llm` parameter as `LlmService`
- [X] T011 [P] Change `src/graph/nodes/analyticalResponseNode.ts` to type its `llm` parameter as `LlmService`
- [X] T012 Update `src/graph/factory.ts` to build the LLM via `createLlmService(config...)` instead of `new OpenRouterService()`
- [X] T013 Assert single-provider wiring (FR-002): confirm `buildAuroraGraph` constructs exactly one `LlmService` via `createLlmService` and passes that same instance to all four nodes (queryPlanner, sqlGenerator, sqlCorrection, analyticalResponse); cover with a smoke test in `tests/providers/factory-wiring.test.ts` that injects a stub `LlmService` and asserts each node received it

**Checkpoint**: Existing OpenRouter behavior works unchanged, now through the abstraction.

---

## Phase 3: User Story 1 - Run Aurora on a chosen provider (Priority: P1) 🎯 MVP

**Goal**: An operator selects OpenRouter, Anthropic, or OpenAI via config and Aurora serves
questions on that provider for every model-backed step.

**Independent Test**: Configure for Anthropic (then OpenAI), ask a known question, and confirm a
grounded answer with WHO attribution is returned using only that provider, with no code changes.

### Tests for User Story 1

- [X] T014 [P] [US1] Add provider-parity e2e scaffolding in `tests/providers/provider-parity.e2e.test.ts` plus a provider-selection helper in `tests/helpers.ts`; assert a known data question returns a grounded answer WITH attribution against the active provider (contract §4 T-1), skipping when no key/DB

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement `OpenAIService implements LlmService` (LangChain `ChatOpenAI`, default base URL, `OPENAI_API_KEY`/`OPENAI_MODEL`) in `src/services/openaiService.ts`, reusing the `createAgent` + `providerStrategy` structured-output pattern
- [X] T016 [P] [US1] Implement `AnthropicService implements LlmService` (LangChain `ChatAnthropic`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`) in `src/services/anthropicService.ts`, reusing the same structured-output pattern
- [X] T017 [US1] Validate Anthropic structured-output parity BEFORE factory wiring (depends on T016): add a focused probe `tests/providers/anthropic-structured.probe.test.ts` that calls `AnthropicService.generateStructured` with a small zod schema and asserts a schema-valid object is returned (no JSON-parse failure). If `providerStrategy` is incompatible with `ChatAnthropic`, switch that service to LangChain `model.withStructuredOutput(schema)` and record the decision in `research.md` (R1)
- [X] T018 [US1] Wire the `openai` and `anthropic` branches into `createLlmService` in `src/services/llmFactory.ts` (depends on T015, T016, T017)
- [X] T019 [US1] Manually verify per `quickstart.md`: set `LLM_PROVIDER=anthropic` then `=openai`, rebuild app, and confirm a grounded Portuguese answer + attribution from `POST /chat`

**Checkpoint**: Aurora runs on any of the three providers selected purely by configuration.

---

## Phase 4: User Story 2 - Switch providers safely via configuration (Priority: P2)

**Goal**: Changing the active provider is config-only and validated fail-fast at startup with
clear, secret-free messages.

**Independent Test**: Select a provider but omit its key → app refuses to start with a clear
message naming the missing variable (no secret shown); supply the key → it starts and answers.

### Tests for User Story 2

- [X] T020 [P] [US2] Add startup-validation tests in `tests/providers/provider-config.test.ts`: unsupported `LLM_PROVIDER` → fatal; missing active key → fatal; missing active model → fatal; messages contain the env-var name but never the secret value (contract §3)

### Implementation for User Story 2

- [X] T021 [US2] Implement fail-fast validation in `src/services/llmFactory.ts` (and/or `src/config.ts`): reject unsupported provider and missing key/model at construction, throwing secret-free errors that name the offending env var (FR-006, contract F-2)
- [X] T022 [US2] Audit error/log paths so provider API keys never appear in `src/guards/errorSanitizer.ts` outputs, thrown errors, or console logs across all three services (FR-007)

**Checkpoint**: Misconfiguration is caught before serving; switching providers needs only config.

---

## Phase 5: User Story 3 - Identical guarantees & graceful failure across providers (Priority: P3)

**Goal**: Every constitutional guarantee holds identically on all providers, and provider
slowness/failure yields a safe Portuguese error within the timeout instead of a hang.

**Independent Test**: For the active provider, run guardrail scenarios (mutation blocked, medical
refused, injection refused, attribution present, Portuguese output) and a simulated stall →
confirm identical outcomes and a bounded safe error.

### Tests for User Story 3

- [X] T023 [US3] Extend `tests/providers/provider-parity.e2e.test.ts` with guardrail parity assertions against the active provider: mutating request blocked, medical request refused, injection refused, data answers in Portuguese (contract §4 T-2…T-5)
- [X] T024 [US3] Add a stall/timeout test in `tests/providers/provider-parity.e2e.test.ts` (or a sibling unit test) asserting a stalled provider yields a safe Portuguese error within the configured timeout, not an indefinite hang (contract §4 T-6)

### Implementation for User Story 3

- [X] T025 [US3] Apply the uniform timeout + bounded retries (`LLM_TIMEOUT_MS`/`LLM_MAX_RETRIES`) consistently in `src/services/openaiService.ts` and `src/services/anthropicService.ts` (parity with `openrouterService.ts`) (FR-009)
- [X] T026 [US3] Ensure provider failures (timeout, rate limit, malformed structured output) are caught in each service's `generateStructured` and surfaced as the existing safe Portuguese error via node fallbacks / `src/guards/errorSanitizer.ts`; raw provider error logged only (FR-008, FR-010)

**Checkpoint**: All three providers are interchangeable with identical guarantees and safe failure.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final verification across providers.

- [X] T027 [P] Update `README.md` to document the three-provider selection (`LLM_PROVIDER`) and per-provider env vars
- [X] T028 [P] Run Biome lint/format (`npm run lint`, `npm run format`) and fix any issues introduced
- [X] T029 Run the full test suite (`npm run test:e2e`) and the `quickstart.md` verification for each provider with a key available

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - US1 (P1) is the MVP. US2 and US3 build on the factory/abstraction but are independently testable.
- **Polish (Phase 6)**: After the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: Needs Phase 2 (interface, factory skeleton, config). Delivers provider selection.
- **US2 (P2)**: Needs Phase 2; enriches the factory with validation. Independent of US1's new services (validates whichever provider is active).
- **US3 (P3)**: Needs Phase 2 and the provider services from US1 to assert cross-provider parity.

### Within Each User Story

- Tests are written first and expected to fail before implementation.
- Services before the Anthropic structured-output probe; probe before factory wiring; wiring before manual verification.

### Parallel Opportunities

- Setup: T002, T003 in parallel.
- Foundational: node retypes T008–T011 in parallel (different files) after T004.
- US1: T014 (test scaffolding), T015 (OpenAIService), and T016 (AnthropicService) in parallel (different files); then T017 probe (needs T016), then T018 wiring (needs T015–T017).
- Polish: T027, T028 in parallel.

---

## Parallel Example: User Story 1

```bash
# After Phase 2, launch the two new provider services together (different files):
Task: "Implement OpenAIService in src/services/openaiService.ts"      # T015
Task: "Implement AnthropicService in src/services/anthropicService.ts" # T016
# Then probe Anthropic structured output (T017), wire both into the factory (T018), then verify (T019).
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup → 2. Phase 2: Foundational → 3. Phase 3: US1 → **STOP & VALIDATE** running on
   Anthropic and OpenAI → demo. OpenRouter continues to work as the default throughout.

### Incremental Delivery

1. Setup + Foundational → abstraction in place, OpenRouter unchanged.
2. US1 → run on any provider (MVP).
3. US2 → safe switching + fail-fast validation.
4. US3 → verified parity + graceful failure.
5. Polish → docs + full verification.

---

## Notes

- [P] = different files, no incomplete-task dependencies.
- No DB, prompt, guard, or `POST /chat` contract changes — keep them untouched (data-model §Non-changes).
- Default provider stays `openrouter` so existing deployments need zero config change (FR-005, SC-006).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
