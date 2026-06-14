# Phase 0 Research: Multi-Provider LLM Compatibility

**Feature**: `002-multi-llm-providers` | **Date**: 2026-06-14

This document records the technical decisions that resolve the open questions for adding
Anthropic and OpenAI as alternatives to the existing OpenRouter provider. There are no
`NEEDS CLARIFICATION` items in the spec; the items below are best-practice/integration
decisions for the chosen stack.

## R1 — How to add Anthropic and OpenAI as LangChain chat models

**Decision**: Use one LangChain chat-model class per provider behind a shared interface:
- **OpenRouter** (existing): `ChatOpenAI` from `@langchain/openai` with
  `configuration.baseURL = "https://openrouter.ai/api/v1"` and the OpenRouter headers.
- **OpenAI** (new): `ChatOpenAI` from `@langchain/openai` with the default base URL (no
  `baseURL` override) and `OPENAI_API_KEY`.
- **Anthropic** (new): `ChatAnthropic` from a new `@langchain/anthropic` dependency with
  `ANTHROPIC_API_KEY`.

**Rationale**: The current `OpenRouterService.generateStructured` builds structured output via
`createAgent({ model, tools: [], responseFormat: providerStrategy(schema) })`. `createAgent`
accepts any LangChain `BaseChatModel`, so the only thing that varies per provider is the
concrete model instance and its credentials/model id — the generation code is reusable
verbatim. OpenRouter and OpenAI share the same `ChatOpenAI` class (OpenRouter is
OpenAI-API-compatible), differing only by base URL/headers.

**Alternatives considered**:
- LangChain `initChatModel(model, { modelProvider })` unified initializer — convenient, but
  hides per-provider config (base URL/headers for OpenRouter, structured-output knobs) that we
  already manage explicitly; rejected to keep config explicit and avoid surprises.
- Calling each vendor SDK directly (Anthropic SDK / OpenAI SDK) — would duplicate the
  structured-output and retry handling already provided through LangChain; rejected.

**Implementation note**: confirm the exact `@langchain/anthropic` version compatible with the
installed `@langchain/core` (^1.x) / `langchain` (^1.x) at install time. If
`providerStrategy(schema)` does not produce schema-valid output on `ChatAnthropic` (verified by
the probe task before factory wiring), fall back to `model.withStructuredOutput(schema)` for that
provider; the `LlmService` contract is unchanged either way.

## R2 — Provider selection and configuration shape

**Decision**: Add a single selector `LLM_PROVIDER ∈ {openrouter, anthropic, openai}` plus
per-provider key/model env vars, resolved in `config.ts`:
- `LLM_PROVIDER` (default `openrouter` when unset → backward compatibility, FR-005/SC-006)
- OpenRouter: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (+ existing referer/title headers)
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`
- Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- Shared: `OPENROUTER_TIMEOUT_MS`/retries generalized to apply to the active provider
  (timeout + bounded retries already exist in config).

**Rationale**: Mirrors the existing env-driven `config.openrouter` block; one active provider
per deployment matches the current single-client architecture and the spec's Assumptions
(no simultaneous providers, no per-request routing). Defaulting to OpenRouter keeps existing
deployments working with zero config change.

**Alternatives considered**:
- A single `LLM_MODEL` + provider inferred from a model prefix — brittle and ambiguous across
  providers; rejected in favor of an explicit selector.
- JSON/YAML provider config file — heavier than needed; env vars are the project convention.

## R3 — Startup validation (fail-fast)

**Decision**: On startup, the provider factory validates that (a) `LLM_PROVIDER` is one of the
supported values and (b) the selected provider's API key and model are present and non-empty.
If invalid, throw a clear error that names the missing/invalid setting (never the secret value)
before the Fastify server begins serving requests.

**Rationale**: FR-006/SC-003 require misconfiguration to be caught before any user request.
Failing at construction (in `buildAuroraGraph`/factory) guarantees the server never starts in a
half-configured state.

**Alternatives considered**:
- Lazy validation on first request — would surface as a failed user turn instead of a clear
  operational error; rejected.

## R4 — Behavioral parity and graceful failure across providers

**Decision**: Keep all prompts (`prompts/v1/*`), guards (`sqlGuard`, `errorSanitizer`), the
attribution append, and the Portuguese-output rules provider-independent. Provider failures
(timeout, rate limit, unavailability, malformed structured output) are caught in
`generateStructured` and surfaced as the existing safe Portuguese error via the node fallbacks
and `errorSanitizer`; the raw provider error is logged server-side only.

**Rationale**: FR-004/FR-008/FR-010 require identical guarantees and safe failure regardless of
provider. Since the guardrails live outside the LLM client, swapping providers cannot weaken
them. The uniform timeout/retries (R2) bound hangs identically for all providers (FR-009/SC-005).

**Alternatives considered**:
- Provider-specific prompt tuning — rejected for v1 to preserve strict parity and testability;
  can be revisited if a provider underperforms on structured SQL output.
- Automatic cross-provider failover — explicitly out of scope per spec Assumptions.

## R5 — Verifying parity in tests

**Decision**: Add a provider-parity e2e test that, when a live provider is configured, runs the
core guardrail and attribution assertions (mutation blocked, medical refused, injection refused,
attribution present, Portuguese output) against whichever provider is active. Deterministic
guard tests remain provider-independent and always run.

**Rationale**: SC-002 demands 100% guardrail parity. Reusing the existing assertion logic
against the active provider keeps the matrix cheap and avoids duplicating expectations per
provider. CI/local can exercise each provider by setting `LLM_PROVIDER` + its key.

**Alternatives considered**:
- A full 3×N provider matrix forced to run on every test invocation — costly and requires three
  live keys; rejected in favor of running against the active provider, gated on key presence.

## Summary of resulting choices

| Topic | Choice |
|-------|--------|
| Anthropic client | `ChatAnthropic` (`@langchain/anthropic`, new dep) |
| OpenAI client | `ChatOpenAI` (`@langchain/openai`, no base URL) |
| OpenRouter client | `ChatOpenAI` + OpenRouter base URL/headers (unchanged) |
| Selection | `LLM_PROVIDER` env, default `openrouter` |
| Abstraction | `LlmService` interface implemented by 3 services, chosen by `llmFactory` |
| Validation | Fail-fast at startup; secret-free messages |
| Parity | Same prompts/guards/attribution; provider-parity e2e test |
| Failure | Caught → safe Portuguese error; raw error logged only |
