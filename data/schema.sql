-- Aurora star schema — WHO MORT_200 "Deaths per 1,000 live births" dataset.
-- Run by data/seed.ts using the admin role. Idempotent: drops and recreates analytics tables.

-- ---------------------------------------------------------------------------
-- Clean slate (analytics tables only — conversation tables preserved below)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS fact_observation CASCADE;
DROP TABLE IF EXISTS dim_cause CASCADE;
DROP TABLE IF EXISTS dim_age_group CASCADE;
DROP TABLE IF EXISTS dim_time CASCADE;
DROP TABLE IF EXISTS dim_geography CASCADE;

-- ---------------------------------------------------------------------------
-- Geography dimension (194 WHO member states)
-- ---------------------------------------------------------------------------
CREATE TABLE dim_geography (
  geo_code     VARCHAR(10)  PRIMARY KEY,   -- ISO alpha-3 (e.g. BRA, AGO)
  geo_name     VARCHAR(120) NOT NULL,      -- English country name
  region_code  VARCHAR(10)  NOT NULL,      -- WHO region code (AFR, AMR, …)
  region_name  VARCHAR(60)  NOT NULL       -- WHO region name
);

-- ---------------------------------------------------------------------------
-- Time dimension (2000–2017)
-- ---------------------------------------------------------------------------
CREATE TABLE dim_time (
  time_year SMALLINT PRIMARY KEY
);

-- ---------------------------------------------------------------------------
-- Age group dimension
-- ---------------------------------------------------------------------------
CREATE TABLE dim_age_group (
  age_code  VARCHAR(40) PRIMARY KEY,  -- e.g. AGEGROUP_DAYS0-27
  age_name  VARCHAR(20) NOT NULL,     -- e.g. '0-27 days'
  age_label VARCHAR(40) NOT NULL      -- e.g. 'Neonatal (0-27 dias)'
);

-- ---------------------------------------------------------------------------
-- Cause of death dimension (14 WHO child causes + synthetic ALL_CAUSES total)
-- ---------------------------------------------------------------------------
CREATE TABLE dim_cause (
  cause_code VARCHAR(30)  PRIMARY KEY,  -- e.g. CHILDCAUSE_CH10 or ALL_CAUSES
  cause_name VARCHAR(120) NOT NULL
);

-- ---------------------------------------------------------------------------
-- Fact: one rate estimate (deaths per 1,000 live births)
-- ---------------------------------------------------------------------------
CREATE TABLE fact_observation (
  fact_id      SERIAL      PRIMARY KEY,
  geo_code     VARCHAR(10) NOT NULL REFERENCES dim_geography(geo_code),
  time_year    SMALLINT    NOT NULL REFERENCES dim_time(time_year),
  age_code     VARCHAR(40) NOT NULL REFERENCES dim_age_group(age_code),
  cause_code   VARCHAR(30) NOT NULL REFERENCES dim_cause(cause_code),
  rate_per_1000 NUMERIC(10,4),
  CONSTRAINT rate_non_negative CHECK (rate_per_1000 IS NULL OR rate_per_1000 >= 0),
  UNIQUE (geo_code, time_year, age_code, cause_code)
);

CREATE INDEX idx_fact_geo   ON fact_observation (geo_code);
CREATE INDEX idx_fact_year  ON fact_observation (time_year);
CREATE INDEX idx_fact_age   ON fact_observation (age_code);
CREATE INDEX idx_fact_cause ON fact_observation (cause_code);

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
  vega_spec       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_msg_conv_id
  ON conversation_message (conversation_id, created_at ASC);
