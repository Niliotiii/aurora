# Quickstart: Selecting an LLM Provider

**Feature**: `002-multi-llm-providers` | **Date**: 2026-06-14

Aurora can run on **OpenRouter** (default), **OpenAI**, or **Anthropic**. You choose the
provider with a single environment variable and supply that provider's API key and model.
Switching providers requires only configuration changes — no code changes.

## 1. Choose a provider

Set `LLM_PROVIDER` in `.env` to one of: `openrouter` (default), `openai`, `anthropic`.

### OpenRouter (default — unchanged)

```dotenv
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4-6
# optional headers
OPENROUTER_HTTP_REFERER=
OPENROUTER_X_TITLE=Aurora
```

> Leaving `LLM_PROVIDER` unset is equivalent to `openrouter`, so existing deployments keep
> working with no change.

### OpenAI

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5
```

### Anthropic

```dotenv
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### Shared (optional, all providers)

```dotenv
LLM_TIMEOUT_MS=30000      # fail fast instead of hanging
LLM_MAX_RETRIES=2
```

## 2. Apply the change

Docker (recommended):

```bash
docker compose up -d --build app    # rebuild picks up new deps + code; env is read from .env
docker exec aurora_app sh -c 'echo $LLM_PROVIDER'   # confirm the active provider
```

Local dev:

```bash
npm install        # installs @langchain/anthropic for the Anthropic provider
npm run dev
```

## 3. Verify it works

```bash
curl -s -X POST http://localhost:4000/chat \
  -H 'Content-Type: application/json' \
  --data '{"question":"Qual foi a taxa de mortalidade neonatal do Brasil em 2000?"}'
```

Expect a Portuguese answer plus the WHO attribution — identical shape regardless of provider.

## 4. Misconfiguration behavior

- **Missing key or model** for the selected provider → the app **fails to start** with a clear
  message naming the missing variable (it never prints the secret).
- **Unsupported `LLM_PROVIDER`** value → fatal startup error listing the supported values.
- **Provider stall / rate limit / outage at request time** → the user receives a safe
  Portuguese error within the timeout; the raw provider error is logged server-side only.

## 5. Run the parity tests (optional)

With a provider key set and a seeded DB:

```bash
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=claude-sonnet-4-6 \
  npm run test:e2e
```

The guardrail/attribution checks run against whichever provider is active; deterministic guard
tests run regardless of any key.
