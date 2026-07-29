CREATE TABLE guild_settings (
  guild_id TEXT PRIMARY KEY,
  setup_version INTEGER NOT NULL DEFAULT 0 CHECK (setup_version >= 0),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE configs (
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, config_key)
);

CREATE TABLE panels (
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  panel_key TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, panel_key)
);

CREATE TABLE members (
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  game_nick TEXT,
  status TEXT NOT NULL DEFAULT 'visitor'
    CHECK (status IN ('visitor', 'evaluation', 'member', 'inactive')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE recruits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_key TEXT UNIQUE,
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  nick TEXT NOT NULL,
  age_text TEXT NOT NULL,
  availability TEXT NOT NULL,
  cash_items TEXT NOT NULL,
  balances_text TEXT NOT NULL,
  channel_id TEXT,
  review_message_id TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('awaiting_photo', 'pending', 'processing', 'approved', 'rejected', 'cancelled', 'failed')),
  reviewed_by TEXT,
  decision_note TEXT,
  discord_synced_at TIMESTAMPTZ,
  channel_closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  photo_received_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX recruits_one_active_per_user_idx
  ON recruits (guild_id, user_id)
  WHERE status IN ('awaiting_photo', 'pending', 'processing');
CREATE INDEX recruits_guild_status_created_idx
  ON recruits (guild_id, status, created_at DESC);

CREATE TABLE recruit_images (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recruit_id BIGINT NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  discord_url TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX recruit_images_recruit_id_idx ON recruit_images (recruit_id);
CREATE UNIQUE INDEX recruit_images_one_primary_idx
  ON recruit_images (recruit_id)
  WHERE is_primary;

CREATE TABLE goals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_key TEXT UNIQUE,
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('money', 'tokens')),
  target NUMERIC(30, 2) NOT NULL CHECK (target > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'closed', 'cancelled')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX goals_one_active_per_guild_idx
  ON goals (guild_id)
  WHERE status = 'active';
CREATE INDEX goals_guild_created_idx ON goals (guild_id, created_at DESC);

CREATE TABLE contributions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_key TEXT UNIQUE,
  goal_id BIGINT NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  amount NUMERIC(30, 2) NOT NULL CHECK (amount > 0),
  proof_url TEXT,
  proof_filename TEXT,
  proof_content_type TEXT,
  observation TEXT,
  review_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'cancelled')),
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contributions_goal_id_idx ON contributions (goal_id);
CREATE INDEX contributions_guild_user_created_idx
  ON contributions (guild_id, user_id, created_at DESC);
CREATE INDEX contributions_goal_approved_idx
  ON contributions (goal_id, user_id)
  WHERE status = 'approved';
CREATE UNIQUE INDEX contributions_one_pending_per_user_goal_idx
  ON contributions (guild_id, user_id, goal_id)
  WHERE status IN ('pending', 'processing');

CREATE TABLE logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  target_user_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  message TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX logs_guild_created_idx ON logs (guild_id, created_at DESC);
CREATE INDEX logs_entity_idx ON logs (entity_type, entity_id);
CREATE INDEX logs_correlation_id_idx ON logs (correlation_id);

CREATE TABLE legacy_imports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  status TEXT NOT NULL CHECK (status IN ('completed', 'completed_with_warnings')),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, fingerprint)
);
