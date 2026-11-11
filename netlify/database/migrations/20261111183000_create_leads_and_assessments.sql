-- Aquoral Canada platform: people who leave their details, and every completed dry mouth assessment.
-- Assessments are kept even when someone skips the details step (lead_id is then NULL, no personal data).

CREATE TABLE leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,            -- stored lower-cased
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  phone            TEXT,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,  -- CASL express consent
  opt_in_at        TIMESTAMPTZ,
  source           TEXT NOT NULL DEFAULT 'assessment',
  locale           TEXT NOT NULL DEFAULT 'en-CA',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assessments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  cause        TEXT,
  cause_other  TEXT,
  answers      JSONB NOT NULL,                       -- {"q1": true, ... "q6": false}
  score        SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 6),
  severity     TEXT NOT NULL CHECK (severity IN ('none', 'mild', 'moderate', 'severe')),
  skipped_details BOOLEAN NOT NULL DEFAULT FALSE,
  discount_code TEXT,
  page         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX assessments_created_at_idx ON assessments (created_at DESC);
CREATE INDEX assessments_lead_id_idx ON assessments (lead_id);
