-- Aurora star schema for the WHO GHO "Neonatal mortality rate" dataset (A4C49D3).
-- Run by data/seed.ts using the privileged (admin) role. Idempotent: drops and recreates.

-- ---------------------------------------------------------------------------
-- Clean slate (idempotent re-seed)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS fact_observation CASCADE;
DROP TABLE IF EXISTS dim_term CASCADE;
DROP TABLE IF EXISTS dim_time CASCADE;
DROP TABLE IF EXISTS dim_geography CASCADE;
DROP TABLE IF EXISTS indicator CASCADE;

-- ---------------------------------------------------------------------------
-- Indicator (from the metadata file)
-- ---------------------------------------------------------------------------
CREATE TABLE indicator (
  ind_uuid   TEXT PRIMARY KEY,
  ind_code   TEXT,
  name       TEXT NOT NULL,
  short_name TEXT,
  unit       TEXT
);

-- ---------------------------------------------------------------------------
-- Geography dimension
-- ---------------------------------------------------------------------------
CREATE TABLE dim_geography (
  geo_code_m49   TEXT PRIMARY KEY,
  geo_name_short TEXT NOT NULL,
  geo_code_type  TEXT
);

-- ---------------------------------------------------------------------------
-- Time dimension
-- ---------------------------------------------------------------------------
CREATE TABLE dim_time (
  time_id   SERIAL PRIMARY KEY,
  time_year INTEGER NOT NULL,
  time_type TEXT NOT NULL,
  UNIQUE (time_year, time_type)
);

-- ---------------------------------------------------------------------------
-- Code-list dimension (sex, age, and any coded term) — backs the data dictionary
-- ---------------------------------------------------------------------------
CREATE TABLE dim_term (
  term_set       TEXT NOT NULL,
  term_key       TEXT NOT NULL,
  term_name_main TEXT NOT NULL,
  term_desc_main TEXT,
  PRIMARY KEY (term_set, term_key)
);

-- ---------------------------------------------------------------------------
-- Fact: one measured WHO estimate
-- ---------------------------------------------------------------------------
CREATE TABLE fact_observation (
  obs_id        SERIAL PRIMARY KEY,
  ind_uuid      TEXT NOT NULL REFERENCES indicator (ind_uuid),
  geo_code_m49  TEXT NOT NULL REFERENCES dim_geography (geo_code_m49),
  time_id       INTEGER NOT NULL REFERENCES dim_time (time_id),
  sex           TEXT,
  age           TEXT,
  rate_per_1000 NUMERIC,
  rate_low      NUMERIC,
  rate_high     NUMERIC,
  CONSTRAINT rate_non_negative CHECK (
    (rate_per_1000 IS NULL OR rate_per_1000 >= 0) AND
    (rate_low IS NULL OR rate_low >= 0) AND
    (rate_high IS NULL OR rate_high >= 0)
  ),
  CONSTRAINT rate_bounds_ordered CHECK (
    (rate_low IS NULL OR rate_per_1000 IS NULL OR rate_low <= rate_per_1000) AND
    (rate_high IS NULL OR rate_per_1000 IS NULL OR rate_per_1000 <= rate_high)
  )
);

CREATE INDEX idx_fact_geo  ON fact_observation (geo_code_m49);
CREATE INDEX idx_fact_time ON fact_observation (time_id);

-- ---------------------------------------------------------------------------
-- Application state: conversation sessions (managed by aurora_app role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_message (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_msg_conv_id
  ON conversation_message (conversation_id, created_at ASC);
