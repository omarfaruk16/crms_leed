-- =====================================================================
--  Sky Root Properties CRM — PostgreSQL schema (v2)
--  Optimised for large datasets & fast analytics:
--   * UUID PKs in-DB (pgcrypto); money as BIGINT cents
--   * Account types: admin / owner / employee / affiliate
--   * Unified expenses with field + date range + lead attribution
--   * Composite / partial / GIN / trigram indexes on every hot path
--   * Materialised-friendly aggregate queries (see routes/analytics.js)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- =====================================================================
--  Roles & permissions
-- =====================================================================
CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,
  permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_roles_updated ON roles;
CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
--  Accounts (users) — four distinct account types
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('admin', 'owner', 'employee', 'affiliate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            CITEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  account_type     account_type NOT NULL DEFAULT 'employee',
  role_id          UUID REFERENCES roles(id) ON DELETE SET NULL,
  company          TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  avatar_url       TEXT,
  commission_cents BIGINT NOT NULL DEFAULT 0,   -- affiliate income per won lead
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_accounts_updated ON accounts;
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts (account_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_accounts_role   ON accounts (role_id);
CREATE INDEX IF NOT EXISTS idx_accounts_name_trgm ON accounts USING gin (name gin_trgm_ops);

-- =====================================================================
--  Pipeline stages (ordered, customisable by admin)
--  is_affiliate_min: lowest stage an affiliate may place a lead at.
-- =====================================================================
CREATE TABLE IF NOT EXISTS stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT '#2F7E7E',
  position        INTEGER NOT NULL DEFAULT 0,
  is_won          BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost         BOOLEAN NOT NULL DEFAULT FALSE,
  is_affiliate_min BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stages_position ON stages (position);

-- =====================================================================
--  Events / campaigns (name, description, lead target, cover image)
-- =====================================================================
CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT '',
  cover_url     TEXT,
  event_date    DATE,
  lead_target   INTEGER NOT NULL DEFAULT 0,   -- total successful lead target
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_events_updated ON events;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date DESC);

-- Owners linked to events (M:N). Owner sees data for their linked events.
CREATE TABLE IF NOT EXISTS event_owners (
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_event_owners_account ON event_owners (account_id);

-- =====================================================================
--  Expenses — top-level. A "field" categorises spend; period is a range.
--  One title may have many rows. Leads may be attributed to an expense.
-- =====================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  field         TEXT NOT NULL DEFAULT '',       -- channel / category, e.g. "Google Ads"
  amount_cents  BIGINT NOT NULL DEFAULT 0,
  period_from   DATE,
  period_to     DATE,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_expenses_updated ON expenses;
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_expenses_field  ON expenses (field);
CREATE INDEX IF NOT EXISTS idx_expenses_event  ON expenses (event_id);
CREATE INDEX IF NOT EXISTS idx_expenses_period ON expenses (period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_expenses_title_trgm ON expenses USING gin (title gin_trgm_ops);

-- =====================================================================
--  Leads — central, high-volume table
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  email          CITEXT,
  address        TEXT NOT NULL DEFAULT '',
  budget_cents   BIGINT NOT NULL DEFAULT 0,
  field          TEXT NOT NULL DEFAULT '',          -- channel/source the lead came from
  source         TEXT NOT NULL DEFAULT '',
  score          SMALLINT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  priority       lead_priority NOT NULL DEFAULT 'medium',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  photo_url      TEXT,
  stage_id       UUID REFERENCES stages(id) ON DELETE SET NULL,
  agent_id       UUID REFERENCES accounts(id) ON DELETE SET NULL,
  event_id       UUID REFERENCES events(id) ON DELETE SET NULL,
  expense_id     UUID REFERENCES expenses(id) ON DELETE SET NULL,  -- which spend brought this lead
  added_by       UUID REFERENCES accounts(id) ON DELETE SET NULL,
  follow_up_at   TIMESTAMPTZ,
  won_at         TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_leads_stage    ON leads (stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_agent    ON leads (agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_event    ON leads (event_id);
CREATE INDEX IF NOT EXISTS idx_leads_expense  ON leads (expense_id);
CREATE INDEX IF NOT EXISTS idx_leads_field    ON leads (field);
CREATE INDEX IF NOT EXISTS idx_leads_added_by ON leads (added_by);
CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_score    ON leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads (follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_stage_follow ON leads (stage_id, follow_up_at);
CREATE INDEX IF NOT EXISTS idx_leads_tags     ON leads USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING gin (email gin_trgm_ops);

-- =====================================================================
--  Activities — per-lead timeline + global feed
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('call','email','whatsapp','note','viewing','stage_change','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  account_id  UUID REFERENCES accounts(id) ON DELETE SET NULL,
  type        activity_type NOT NULL DEFAULT 'note',
  body        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activities_lead   ON activities (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_recent ON activities (created_at DESC);

-- =====================================================================
--  Auth audit
-- =====================================================================
CREATE TABLE IF NOT EXISTS auth_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id  UUID REFERENCES accounts(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_log_account ON auth_log (account_id, created_at DESC);
