# Contract: Chat HTTP API

**Feature**: `001-text-to-sql-base` | Server: Fastify (`src/server.ts`)

The web UI talks to the backend through a single endpoint. Mirrors the reference
`POST /sales`, renamed and extended for Aurora.

## `POST /chat`

Submit a natural-language question and receive a grounded answer + optional chart.

### Request

```jsonc
{
  "question": "What was Brazil's neonatal mortality rate in 2000?"  // string, minLength 3, required
}
```

Fastify schema: body `type: object`, `required: ["question"]`,
`question: { type: "string", minLength: 3 }`.

### Response 200

```jsonc
{
  "answer": "In 2000, Brazil's neonatal mortality rate was 19.6 per 1,000 live births.",
  "attribution": "Figures are WHO estimates from the Global Health Observatory.", // ALWAYS present on data-bearing answers (FR-006, Principle III)
  "vegaSpec": { /* Vega-Lite spec */ } | null,   // null when result is a single scalar / not chartable
  "followUpQuestions": ["How did it change from 1990 to 2000?"],
  "query": "SELECT ...",   // the executed (validated) SELECT, for transparency; omitted/redacted on refusals
  "error": null
}
```

### Behavior contract (maps to FRs)

| Condition | Response |
|-----------|----------|
| Data available | `answer` grounded ONLY in `dbResults`; `attribution` present (FR-004/006) |
| Data not in dataset / empty result | `answer` states data unavailable; no fabricated number; `vegaSpec=null` (FR-005) |
| Chartable result (series/comparison) | `vegaSpec` is a Vega-Lite spec (FR-012/SC-008) |
| Generated SQL contains DML/DDL | Blocked before execution; `error` is a safe message; `query` redacted; rejection logged (FR-008/SC-003) |
| Prompt injection / schema probe | Refusal; NO table names/secrets/connection details/system prompt leaked (FR-010/SC-004) |
| Medical advice / causal request | Declines; redirects to what data shows (FR-007/SC-005) |
| Internal failure | HTTP 500 with sanitized message only — no schema/stack/connection info (FR-011) |

### Error response (4xx/5xx)

```jsonc
{ "error": "Could not process the request." }  // sanitized; never leaks internals
```

## Non-goals (this base)

- No authentication, no multi-tenant, no streaming responses, no conversation history
  endpoint (single-turn grounding only).
