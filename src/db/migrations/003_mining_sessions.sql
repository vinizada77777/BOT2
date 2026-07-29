CREATE TABLE mining_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_settings(guild_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_seconds BIGINT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  start_channel_id TEXT,
  finish_channel_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX mining_sessions_one_active_per_user_idx
  ON mining_sessions (guild_id, user_id)
  WHERE status = 'active';

CREATE INDEX mining_sessions_guild_started_idx
  ON mining_sessions (guild_id, started_at DESC);

CREATE INDEX mining_sessions_user_started_idx
  ON mining_sessions (guild_id, user_id, started_at DESC);
