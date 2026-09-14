-- 0001_init UP — mirror docs/SCHEMA.md v1.0 (+ deviasi terdokumentasi di schema.ts).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'BANNED', 'RESTRICTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('USER', 'MODERATOR', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE confession_status AS ENUM ('PENDING', 'VISIBLE', 'QUARANTINED', 'HIDDEN', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE reaction_type AS ENUM ('UNDERSTAND', 'LOVE', 'SAD', 'WILD', 'FUNNY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE report_target AS ENUM ('CONFESSION', 'WHISPER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE mod_action AS ENUM ('DISMISS', 'HIDE', 'REMOVE', 'RESTRICT', 'BAN', 'RESTORE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE publication_status AS ENUM ('PENDING_CHAIN', 'SUBMITTED', 'CONFIRMED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address varchar(42) NOT NULL UNIQUE,
  chain_id bigint NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  status user_status NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE auth_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  nonce_hash varchar(128) NOT NULL UNIQUE,
  domain varchar(255) NOT NULL,
  address varchar(42) NOT NULL,
  chain_id bigint NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX idx_nonces_expiry ON auth_nonces (expires_at);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(128) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  name varchar(64) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash varchar(128) NOT NULL UNIQUE,
  storage_provider varchar(64) NOT NULL DEFAULT 'db:inline',
  storage_cid varchar(256),
  encryption_version varchar(32),
  content_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE confessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id varchar(64) NOT NULL UNIQUE,
  author_user_id uuid NOT NULL REFERENCES users(id),
  category_id uuid NOT NULL REFERENCES categories(id),
  content_object_id uuid NOT NULL REFERENCES content_objects(id),
  body_text text NOT NULL,
  display_seed integer NOT NULL,
  status confession_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  hidden_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  moderation_score numeric NOT NULL DEFAULT 0
);
CREATE INDEX idx_confessions_feed ON confessions (status, created_at DESC);
CREATE INDEX idx_confessions_category ON confessions (category_id, status, created_at DESC);

CREATE TABLE reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id uuid NOT NULL REFERENCES confessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reaction UNIQUE (confession_id, user_id, reaction_type)
);
CREATE INDEX idx_reactions_confession ON reactions (confession_id, reaction_type);

CREATE TABLE whispers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id varchar(64) NOT NULL UNIQUE,
  confession_id uuid NOT NULL REFERENCES confessions(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id),
  content_object_id uuid NOT NULL REFERENCES content_objects(id),
  body_text text NOT NULL,
  display_seed integer NOT NULL,
  status confession_status NOT NULL DEFAULT 'VISIBLE',
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX idx_whispers_confession ON whispers (confession_id, created_at ASC);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES users(id),
  target_type report_target NOT NULL,
  target_id uuid NOT NULL,
  reason_code varchar(32) NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX idx_reports_status ON reports (status, created_at ASC);

CREATE TABLE moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id uuid NOT NULL REFERENCES users(id),
  target_type report_target NOT NULL,
  target_id uuid NOT NULL,
  action mod_action NOT NULL,
  reason_code varchar(32) NOT NULL,
  notes text,
  policy_version varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id uuid NOT NULL REFERENCES confessions(id) ON DELETE CASCADE,
  chain_id bigint NOT NULL,
  contract_address varchar(42) NOT NULL,
  transaction_hash varchar(66),
  block_number bigint,
  onchain_confession_id varchar(66) NOT NULL,
  content_hash varchar(128) NOT NULL,
  status publication_status NOT NULL DEFAULT 'PENDING_CHAIN',
  submitted_at timestamptz,
  confirmed_at timestamptz,
  failure_reason text
);
CREATE INDEX idx_publications_status ON publications (status, submitted_at ASC);

CREATE TABLE rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_hash varchar(128) NOT NULL,
  action varchar(64) NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_rate_bucket UNIQUE (subject_hash, action, window_start)
);

CREATE TABLE feed_scores (
  confession_id uuid NOT NULL REFERENCES confessions(id) ON DELETE CASCADE,
  score_type varchar(32) NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (confession_id, score_type)
);

CREATE TABLE idempotency_keys (
  key varchar(128) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status_code integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT uq_idempotency UNIQUE (key, user_id)
);
