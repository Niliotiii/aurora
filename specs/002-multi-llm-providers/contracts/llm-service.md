# Contract: LLM Service & Provider Configuration

**Feature**: `002-multi-llm-providers` | **Date**: 2026-06-14

This feature exposes no new HTTP endpoint; the `POST /chat` contract from feature 001 is
unchanged. The contracts below are the **internal interface** the pipeline depends on and the
**configuration contract** an operator must satisfy.

## 1. `LlmService` interface contract

All provider implementations MUST conform to this interface so pipeline nodes are
provider-agnostic.

```ts
export type StructuredResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: string };

export interface LlmService {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: ZodSchema<T>,
  ): Promise<StructuredResult<T>>;
}
```

**Behavioral guarantees** (MUST hold for every implementation):

| ID | Guarantee |
|----|-----------|
| C-1 | MUST return `{ success: false, error }` on provider error/timeout/malformed output — never throw to the caller. |
| C-2 | MUST apply the configured request timeout so a call cannot hang indefinitely. |
| C-3 | MUST apply bounded retries (no unbounded retry loops). |
| C-4 | MUST NOT include API keys/secrets in the `error` string. |
| C-5 | On `success: true`, `data` MUST validate against the provided zod `schema`. |
| C-6 | MUST be a drop-in for the existing `OpenRouterService` usage in all four nodes. |

## 2. Provider factory contract

```ts
export function createLlmService(cfg: ProviderConfig): LlmService;
```

| ID | Rule |
|----|------|
| F-1 | MUST return the implementation matching `cfg.provider` (`openrouter` → OpenRouter, `openai` → OpenAI, `anthropic` → Anthropic). |
| F-2 | MUST throw a clear, secret-free error at construction time if `cfg` is invalid (unsupported provider, missing key, missing model). |
| F-3 | MUST be the only place provider selection happens (nodes/`graph/factory.ts` never branch on provider). |

## 3. Configuration contract (operator-facing)

| Setting | Required when | Example | Notes |
|---------|---------------|---------|-------|
| `LLM_PROVIDER` | always (optional; defaults to `openrouter`) | `anthropic` | One of `openrouter` \| `openai` \| `anthropic` |
| `OPENROUTER_API_KEY` | provider = `openrouter` | `sk-or-...` | |
| `OPENROUTER_MODEL` | provider = `openrouter` | `anthropic/claude-sonnet-4-6` | |
| `OPENAI_API_KEY` | provider = `openai` | `sk-...` | |
| `OPENAI_MODEL` | provider = `openai` | `gpt-5` | |
| `ANTHROPIC_API_KEY` | provider = `anthropic` | `sk-ant-...` | |
| `ANTHROPIC_MODEL` | provider = `anthropic` | `claude-sonnet-4-6` | |
| `LLM_TIMEOUT_MS` | optional | `30000` | Falls back to `OPENROUTER_TIMEOUT_MS` then 30000 |
| `LLM_MAX_RETRIES` | optional | `2` | Falls back to `OPENROUTER_MAX_RETRIES` then 2 |

**Validation outcomes**:
- Unset `LLM_PROVIDER` → treated as `openrouter` (backward compatible).
- Unsupported `LLM_PROVIDER` value → fatal startup error listing supported values.
- Missing key/model for the active provider → fatal startup error naming the env var.

## 4. Test contract (parity)

| ID | Assertion (per active provider, when key present) |
|----|---------------------------------------------------|
| T-1 | A known data question returns a grounded answer WITH WHO attribution. |
| T-2 | A mutating request never reaches the DB (guard blocks it). |
| T-3 | A medical/causal request is refused. |
| T-4 | A prompt-injection attempt is refused without leaking internals. |
| T-5 | Data answers are returned in Portuguese. |
| T-6 | A simulated provider stall yields a safe Portuguese error within the timeout, not a hang. |

## 5. Unchanged external contract

`POST /chat` request `{ question }` and response `{ answer, attribution, vegaSpec,
followUpQuestions, query }` are identical to feature 001. The web UI requires no change.
