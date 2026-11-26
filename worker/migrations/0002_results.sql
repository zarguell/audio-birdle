-- Per-day results for streaks and daily summaries.
-- Only outcome metadata is stored: no guesses, no message content, no bird ids.

CREATE TABLE IF NOT EXISTS results (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  date TEXT NOT NULL,
  mode TEXT NOT NULL,
  region TEXT NOT NULL,
  won INTEGER NOT NULL,
  guess_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, date, mode, discord_id)
);

CREATE INDEX IF NOT EXISTS results_by_user ON results(discord_id, date);
