export const STORAGE_KEYS = {
  REGION: "audio-birdle-region",
  GAME_STATE: "audio-birdle-game-state",
  LAST_PLAYED_MODE: "audio-birdle-last-mode",
  CACHE_LAST_MODIFIED: "audio-birdle-last-modified",
  CACHE_ETAG: "audio-birdle-etag",
  DAILY_JSON_LAST_MODIFIED: "audio-birdle-daily-last-modified",
  DAILY_JSON_ETAG: "audio-birdle-daily-etag",
  LAST_VALIDATED_DATE: "audio-birdle-last-validated-date",
  BIRDS_JSON_ETAG: "audio-birdle-birds-etag",
  BIRDS_JSON_LAST_MODIFIED: "audio-birdle-birds-last-modified",
  DEAD_AUDIO_URLS: "audio-birdle-dead-audio-urls",
};

export const GAME_CONFIG = {
  MAX_GUESSES: 4,
  ANSWER_OPTIONS_COUNT: 4,
  // Hard mode configuration
  HARD_MODE_MAX_GUESSES: 6,
  HARD_MODE_HINT_TIMING: {
    ORDER: 1, // Show order hint after guess 1
    FAMILY: 3, // Show family hint after guess 3
    GENUS: 5, // Show genus hint after guess 5
  },
  // Autocomplete matching threshold for fuzzy search
  FUZZY_MATCH_THRESHOLD: 30,
};

export const VIEWS = {
  GAME: "game",
  PRACTICE: "practice",
  HARD_MODE: "hard-mode",
  SETTINGS: "settings",
  REGION_SELECTOR: "region-selector",
  MODE_SELECTOR: "mode-selector",
  STATS: "stats",
};
