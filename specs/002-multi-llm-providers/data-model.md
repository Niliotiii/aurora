# Phase 1 Data Model: Multi-Provider LLM Compatibility

**Feature**: `002-multi-llm-providers` | **Date**: 2026-06-14

This feature introduces **no database changes**. The "entities" here are configuration and
runtime-construction concepts, not persisted records. They formalize the spec's Key Entities
(LLM Provider, Provider Configuration) for implementation.

## Entity: ProviderId

Enumerated selector for the active provider.

| Value | Meaning |
|-------|---------|
| `openrouter` | OpenAI-compatible access via OpenRouter (default) |
| `openai` | Direct OpenAI API |
| `anthropic` | Direct Anthropic API |

- **Validation**: MUST be one of the three values. Unknown/empty → at startup, default to
  `openrouter` only when **unset**; a present-but-unsupported value is a fatal config error.

## Entity: ProviderConfig

Resolved settings for the active provider (built in `config.ts`).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `provider` | `ProviderId` | yes | From `LLM_PROVIDER` (default `openrouter`) |
| `apiKey` | string | yes | The active provider's key; MUST be non-empty |
| `model` | string | yes | The active provider's model id; MUST be non-empty |
| `temperature` | number | no | Shared default (e.g., 0.2) |
| `requestTimeoutMs` | number | no | Uniform timeout (default 30000) |
| `maxRetries` | number | no | Uniform bounded retries (default 2) |
| `openrouterHeaders` | object | no | Only for `openrouter`: HTTP-Referer, X-Title |

- **Validation rules** (fail-fast at startup, FR-006/SC-003):
  - `provider` ∈ supported set (else fatal: "unsupported LLM_PROVIDER: <value>").
  - `apiKey` present & non-empty for the active provider (else fatal, naming the env var, never
    the value).
  - `model` present & non-empty for the active provider (else fatal, naming the env var).
- **Secret handling** (FR-007): `apiKey` MUST never be serialized into responses, logs, or
  error messages.

### Per-provider environment mapping

| Provider | Key env | Model env | Extra |
|----------|---------|-----------|-------|
| `openrouter` | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` | `OPENROUTER_HTTP_REFERER`, `OPENROUTER_X_TITLE` |
| `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` | — |
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` | — |
| shared | — | — | `OPENROUTER_TIMEOUT_MS`→`LLM_TIMEOUT_MS`, `OPENROUTER_MAX_RETRIES`→`LLM_MAX_RETRIES` (old names kept as fallback) |

## Entity: LlmService (interface)

The provider-agnostic contract every provider implementation satisfies. Already realized today
by `OpenRouterService`.

| Member | Signature | Notes |
|--------|-----------|-------|
| `generateStructured<T>` | `(systemPrompt: string, userPrompt: string, schema: ZodSchema<T>) => Promise<StructuredResult<T>>` | Returns `{ success: true, data }` or `{ success: false, error }`; never throws to the caller |

- **StructuredResult<T>** (existing type, promoted to the shared module):
  - `{ success: true; data: T; error?: undefined }`
  - `{ success: false; data?: undefined; error: string }`

## Construction flow (runtime, not persisted)

```text
config.ts  ──reads env──▶ ProviderConfig (validated)
                                │
                                ▼
llmFactory(ProviderConfig) ──selects──▶ one of:
   • OpenRouterService  (ChatOpenAI + OpenRouter baseURL/headers)
   • OpenAIService      (ChatOpenAI, default baseURL)
   • AnthropicService   (ChatAnthropic)
                                │  (all implement LlmService)
                                ▼
graph/factory.ts ──injects LlmService──▶ pipeline nodes
   (queryPlanner, sqlGenerator, sqlCorrection, analyticalResponse)
```

## Non-changes (explicit)

- **GraphState**, the `POST /chat` request/response shape, the Postgres star schema, the data
  dictionary, prompts, `sqlGuard`, and `errorSanitizer` are **unchanged**. End users and the web
  UI observe no contract difference.
