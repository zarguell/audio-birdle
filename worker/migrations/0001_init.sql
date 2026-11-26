-- Audio-Birdle Discord Activity schema.
-- Discord identities are stored by id only; no message content is persisted.

CREATE TABLE IF NOT EXISTS players (
  discord_id TEXT PRIMARY KEY,
  username TEXT,
  avatar TEXT,
  region TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS boards (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  date TEXT NOT NULL,
  message_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (guild_id, channel_id, discord_id, date)
);

CREATE INDEX IF NOT EXISTS boards_by_day
  ON boards (guild_id, channel_id, date);

CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  summary_channel_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  day TEXT NOT NULL,
  player_hash TEXT NOT NULL,
  mode TEXT,
  region TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, player_hash)
);
