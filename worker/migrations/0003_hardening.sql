-- Release-blocking hardening: launch binding, rate limits, and per-mode boards.
-- `boards` is empty in production, so it is safe to recreate with `mode` as part
-- of the primary key. Normal and hard games then get separate board messages.

CREATE TABLE IF NOT EXISTS launches (
  discord_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (discord_id, guild_id, channel_id)
);

CREATE INDEX IF NOT EXISTS launches_by_created
  ON launches (created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  subject TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (subject, window_start)
);

DROP TABLE IF EXISTS boards;

CREATE TABLE boards (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  date TEXT NOT NULL,
  mode TEXT NOT NULL,
  message_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (guild_id, channel_id, discord_id, date, mode)
);

CREATE INDEX IF NOT EXISTS boards_by_day
  ON boards (guild_id, channel_id, date, mode);
