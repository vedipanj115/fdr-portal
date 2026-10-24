-- Draft PostgreSQL schema (Preet to refine)

CREATE TABLE institutions (
  id            TEXT PRIMARY KEY,          -- AICTE permanent ID, e.g. 1-1234567
  name          TEXT NOT NULL,
  state         TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('INSTITUTION','OFFICER','ADMIN')),
  institution_id TEXT REFERENCES institutions(id)
);

CREATE TABLE fdrs (
  id            TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  fdr_number    TEXT NOT NULL,
  bank_name     TEXT NOT NULL,
  branch        TEXT,
  ifsc          TEXT,
  amount        BIGINT NOT NULL CHECK (amount > 0),
  issue_date    DATE NOT NULL,
  maturity_date DATE NOT NULL CHECK (maturity_date > issue_date),
  status        TEXT NOT NULL DEFAULT 'SUBMITTED',
  document_url  TEXT,
  renewed_from  TEXT REFERENCES fdrs(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_name, fdr_number)            -- same FDR can't be submitted twice
);

CREATE TABLE verification_fields (
  id        SERIAL PRIMARY KEY,
  fdr_id    TEXT NOT NULL REFERENCES fdrs(id),
  field     TEXT NOT NULL,
  claimed   TEXT,
  extracted TEXT,
  bank      TEXT,
  result    TEXT NOT NULL CHECK (result IN ('MATCH','MISMATCH','MISSING'))
);

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id   INT REFERENCES users(id),
  action     TEXT NOT NULL,
  fdr_id     TEXT REFERENCES fdrs(id),
  details    JSONB,
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL               -- sha256(prev_hash || at || actor_id || action || fdr_id || details)
);

CREATE TABLE notifications (
  id        BIGSERIAL PRIMARY KEY,
  user_id   INT REFERENCES users(id),
  fdr_id    TEXT REFERENCES fdrs(id),
  type      TEXT NOT NULL,               -- REMINDER_90, REMINDER_30, ESCALATION, ...
  message   TEXT NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  read      BOOLEAN NOT NULL DEFAULT false
);
