# Contract: Pipeline (LangGraph) State & Nodes

**Feature**: `001-text-to-sql-base` | `src/graph/graph.ts`, `src/graph/nodes/*`

The agent is a `StateGraph` (LangGraph) mirroring the reference Text-to-Cypher pipeline,
reimplemented for SQL. Nodes communicate via a shared `GraphState`.

## `GraphState` (zod schema)

| Field | Type | Set by | Purpose |
|-------|------|--------|---------|
| messages | BaseMessage[] | caller | input chat messages |
| question | string? | extractQuestion | the user question |
| query | string? | sqlGenerator / sqlCorrection | generated SQL (SELECT only) |
| originalQuery | string? | sqlExecutor | first attempt, kept for correction |
| dbResults | any[]? | sqlExecutor | rows returned (the ONLY grounding source) |
| correctionAttempts | number? | sqlExecutor | bounded by `maxCorrectionAttempts` (=1) |
| validationError | string? | sqlExecutor | EXPLAIN/guard error fed to corrector |
| needsCorrection | boolean? | sqlExecutor | routes to sqlCorrection |
| answer | string? | analyticalResponse | grounded natural-language answer |
| attribution | string? | analyticalResponse | WHO-estimate notice (always on data answers) |
| vegaSpec | object? | analyticalResponse | Vega-Lite spec or null |
| followUpQuestions | string[]? | analyticalResponse | suggestions |
| error | string? | any node | sanitized error / refusal marker |

## Nodes & edges

```
START → extractQuestion
extractQuestion → (error? END : queryPlanner)
queryPlanner → sqlGenerator
sqlGenerator → sqlExecutor
sqlExecutor → (needsCorrection && attempts<max ? sqlCorrection
              : analyticalResponse)
sqlCorrection → sqlExecutor
analyticalResponse → END
```

### Node contracts

- **extractQuestionNode**: derive `question` from `messages`; set `error` if empty.
- **queryPlannerNode**: classify scope (in-dataset vs out-of-scope vs adversarial vs
  medical) and optionally outline steps. Out-of-scope/medical/injection → mark for a safe
  refusal answer (no SQL generated). (FR-007, FR-010)
- **sqlGeneratorNode**: produce a single `SELECT` over the WHO schema using the injected
  **data dictionary**; structured output `{ sql, rationale }`. MUST NOT reference system
  catalogs or secrets. (FR-002, FR-013, Principle I/V)
- **sqlExecutorNode**: run `query` through `guards/sqlGuard` (reject DML/DDL/multi-
  statement) → `EXPLAIN` validate → execute via read-only pool. On failure within budget,
  set `needsCorrection`; else set sanitized `error`. Log a `QueryAuditRecord`. (FR-008/
  FR-009/FR-014)
- **sqlCorrectionNode**: given `validationError` + `originalQuery`, produce a corrected
  `SELECT`; increment `correctionAttempts`.
- **analyticalResponseNode**: write `answer` grounded ONLY in `dbResults`; if no rows →
  "data unavailable"; ALWAYS set `attribution`; build `vegaSpec` (or null); never add
  medical/causal claims. (FR-004/005/006/007/012, Principle II/III)

## Invariants

1. No node may emit a number not present in `dbResults`.
2. `attribution` is non-empty whenever `answer` reports data.
3. Only a validated single `SELECT` ever reaches the database.
4. `error` messages exposed outward are sanitized (no schema/stack/secrets).
