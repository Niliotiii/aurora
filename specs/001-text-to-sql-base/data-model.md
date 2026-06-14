# Phase 1 Data Model: Text-to-SQL Conversational Agent — Initial Base

**Feature**: `001-text-to-sql-base` | **Date**: 2026-06-10

Derived from the WHO source files in `A4C49D3_3.2.2- Neonatal mortality rate/`:
`076_A4C49D3_Dataset_2024-05-16.csv`, `076_A4C49D3_Code list_2024-05-16.csv`,
`076_A4C49D3_Metadata_2024-05-16.csv`. Modeled as a star schema in PostgreSQL.

## Source columns (reference)

Dataset CSV header:
`IND_UUID, IND_NAME, DIM_GEO_CODE_TYPE, DIM_GEO_CODE_M49, GEO_NAME_SHORT,
DIM_TIME_TYPE, DIM_TIME, Sex, Age, RATE_PER_1000_N, RATE_PER_1000_NL, RATE_PER_1000_NU`

Code list CSV header: `TERM_SET, TERM_KEY, TERM_NAME_MAIN, TERM_DESC_MAIN`
Metadata CSV: `Property, Value` (Name, Short name, Indicator unique identifier =
`A4C49D3`, Indicator codes = `WHOSIS_000003`, …).

## Database entities

### `indicator`
The metric definition (from metadata). One row for this base feature.

| Column | Type | Notes |
|--------|------|-------|
| ind_uuid | text PK | `A4C49D3` |
| ind_code | text | `WHOSIS_000003` |
| name | text | "Neonatal mortality rate (per 1000 live births)" |
| short_name | text | from metadata |
| unit | text | "per 1000 live births" |

### `dim_geography`
One row per place referenced by observations.

| Column | Type | Notes |
|--------|------|-------|
| geo_code_m49 | text PK | e.g. `076` (Brazil) |
| geo_name_short | text | e.g. `Brazil` |
| geo_code_type | text | e.g. `COUNTRY` |

### `dim_time`
One row per time point.

| Column | Type | Notes |
|--------|------|-------|
| time_id | serial PK | surrogate |
| time_year | int | e.g. `2000` (from `DIM_TIME`) |
| time_type | text | e.g. `YEAR` |
| UNIQUE (time_year, time_type) | | |

### `dim_term`
The code-list dimension lookup (sex, age, and any coded term). Backs the data dictionary.

| Column | Type | Notes |
|--------|------|-------|
| term_set | text | e.g. `DIM_AGE`, `DIM_SEX` |
| term_key | text | e.g. `D_LE27`, `TOTAL` |
| term_name_main | text | e.g. `0 to 27 days`, `Total` |
| term_desc_main | text | long description |
| PRIMARY KEY (term_set, term_key) | | |

### `fact_observation`
One measured WHO estimate.

| Column | Type | Notes |
|--------|------|-------|
| obs_id | serial PK | surrogate |
| ind_uuid | text FK → indicator | always `A4C49D3` here |
| geo_code_m49 | text FK → dim_geography | |
| time_id | int FK → dim_time | |
| sex | text | label as in dataset (`Total`, …); joinable to `dim_term` where `term_set='DIM_SEX'` |
| age | text | label as in dataset (`0 to 27 days`); joinable to `dim_term` where `term_set='DIM_AGE'` |
| rate_per_1000 | numeric | `RATE_PER_1000_N` (point estimate) |
| rate_low | numeric | `RATE_PER_1000_NL` (lower bound) |
| rate_high | numeric | `RATE_PER_1000_NU` (upper bound) |

**Relationships**: `fact_observation` N→1 `indicator`, N→1 `dim_geography`,
N→1 `dim_time`; `sex`/`age` labels map to `dim_term` rows by term set.

### Validation rules (from requirements)

- `rate_per_1000`, `rate_low`, `rate_high` are non-negative; `rate_low ≤ rate_per_1000 ≤
  rate_high` where all present.
- Every fact row references an existing geography, time, and the single indicator.
- Seeding is idempotent (re-running yields the same row set).

## Application / pipeline entities (non-persistent)

### `GraphState` (LangGraph state, see contracts/graph-state.md)
Carries: `messages`, `question`, `query` (generated SQL), `originalQuery`, `dbResults`,
`correctionAttempts`, `validationError`, `needsCorrection`, `answer`, `attribution`,
`vegaSpec`, `followUpQuestions`, `error`.

### `DataDictionary`
Built at seed/startup from `indicator` + `dim_term` + table descriptions; injected into
the SQL-generator prompt so the model knows tables, columns, coded values, and how to
join codes to labels (FR-013, Principle I).

### `QueryAuditRecord` (log)
`{ timestamp, question, generatedSql, decision: allowed|rejected, reason }` — written for
every execution attempt, especially guard rejections (FR-008, SC-003).

## Read-only role

A PostgreSQL role (e.g. `aurora_readonly`) is granted `CONNECT` + `USAGE` on schema and
`SELECT` on all tables only — no `INSERT/UPDATE/DELETE/DDL`. The application uses this
role exclusively (Principle IV / FR-009). Seeding uses a separate privileged role run
only by `data/seed.ts`, never by the app at request time.
