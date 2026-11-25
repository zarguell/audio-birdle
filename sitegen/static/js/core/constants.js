export const GAME_CONFIG = Object.freeze({
  MAX_GUESSES: 4,
  ANSWER_OPTIONS_COUNT: 4,
  HARD_MODE_MAX_GUESSES: 6,
  HARD_MODE_HINT_TIMING: Object.freeze({
    ORDER: 1,
    FAMILY: 3,
    GENUS: 5,
  }),
  FUZZY_MATCH_THRESHOLD: 30,
});

export const STORAGE_KEYS = Object.freeze({
  GAME: "audio-birdle-game",
  REGION: "audio-birdle-region",
  REGION_NAME: "audio-birdle-region-name",
  LAST_PLAYED_MODE: "audio-birdle-last-mode",
  DEAD_AUDIO_URLS: "audio-birdle-dead-audio-urls",
  RECENT_REGIONS: "audio-birdle-recent-regions",
  FAVORITE_REGIONS: "audio-birdle-favorite-regions",
  SUGGESTION_DISMISSED: "audio-birdle-suggestion-dismissed",
  LEGACY_GAME_STATE: "audio-birdle-game-state",
  LEGACY_NORMAL_GAME: "audio-birdle-normal-game",
  LEGACY_HARD_MODE: "audio-birdle-hard-mode",
});

export const DATA_FILES = Object.freeze({
  regions: "regions.json",
  birds: "birds.json",
  daily: "daily.json",
  history: "history.json",
});

