-- Per-channel opt-in for daily summaries.
-- A channel, not a guild, is the group: `/audiobirdle-setup` is run inside the
-- channel that should receive summaries. The legacy `guilds` table is kept
-- untouched for old deployments but is no longer read by the cron.

CREATE TABLE IF NOT EXISTS channels (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
