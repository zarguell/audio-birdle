/**
 * Browser game state, persisted in the same `audio-birdle-game` version-2
 * envelope used by the previous React client. That keeps existing players'
 * daily games, streaks, and region stats intact after this refactor.
 */
import { GAME_CONFIG, STORAGE_KEYS } from "./constants.js";
import { readJSON, readString, removeKey, writeJSON } from "./storage.js";

const VERSION = 2;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

let cachedState = null;

const createInitialStats = () => ({
  totalGamesPlayed: 0,
  totalGamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  regionStats: {},
});

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeStats = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const regionStats = {};
  for (const [region, stats] of Object.entries(source.regionStats || {})) {
    if (DANGEROUS_KEYS.has(region)) {
      continue;
    }
    regionStats[region] = {
      gamesPlayed: toNumber(stats?.gamesPlayed),
      gamesWon: toNumber(stats?.gamesWon),
      totalGuesses: toNumber(stats?.totalGuesses),
      averageGuesses: toNumber(stats?.averageGuesses),
    };
  }
  return {
    totalGamesPlayed: toNumber(source.totalGamesPlayed),
    totalGamesWon: toNumber(source.totalGamesWon),
    currentStreak: toNumber(source.currentStreak),
    maxStreak: toNumber(source.maxStreak),
    regionStats,
  };
};

const combineStats = (left, right) => {
  const combined = {
    totalGamesPlayed: toNumber(left.totalGamesPlayed) + toNumber(right.totalGamesPlayed),
    totalGamesWon: toNumber(left.totalGamesWon) + toNumber(right.totalGamesWon),
    currentStreak: Math.max(toNumber(left.currentStreak), toNumber(right.currentStreak)),
    maxStreak: Math.max(toNumber(left.maxStreak), toNumber(right.maxStreak)),
    regionStats: {},
  };

  const regions = new Set([
    ...Object.keys(left.regionStats || {}),
    ...Object.keys(right.regionStats || {}),
  ]);
  for (const region of regions) {
    if (DANGEROUS_KEYS.has(region)) {
      continue;
    }
    const leftStats = left.regionStats?.[region] || {};
    const rightStats = right.regionStats?.[region] || {};
    const gamesPlayed =
      toNumber(leftStats.gamesPlayed) + toNumber(rightStats.gamesPlayed);
    const totalGuesses =
      toNumber(leftStats.totalGuesses) + toNumber(rightStats.totalGuesses);
    combined.regionStats[region] = {
      gamesPlayed,
      gamesWon: toNumber(leftStats.gamesWon) + toNumber(rightStats.gamesWon),
      totalGuesses,
      averageGuesses: gamesPlayed > 0 ? totalGuesses / gamesPlayed : 0,
    };
  }
  return combined;
};

const normalizeGuess = (guess) => {
  if (!guess || typeof guess !== "object") {
    return null;
  }
  const normalized = {
    birdId: typeof guess.birdId === "string" ? guess.birdId : null,
    correct: Boolean(guess.correct),
    timestamp: toNumber(guess.timestamp),
  };
  if (typeof guess.textInput === "string") {
    normalized.textInput = guess.textInput;
  }
  if (guess.taxonomicScore && typeof guess.taxonomicScore === "object") {
    normalized.taxonomicScore = {
      order: Boolean(guess.taxonomicScore.order),
      family: Boolean(guess.taxonomicScore.family),
      genus: Boolean(guess.taxonomicScore.genus),
      species: Boolean(guess.taxonomicScore.species),
    };
  }
  return normalized;
};

const normalizeGame = (key, raw) => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const mode = raw.mode === "hard" ? "hard" : "normal";
  const completed = Boolean(raw.completed);
  const game = {
    region:
      typeof raw.region === "string"
        ? raw.region
        : key.replace(/-\d{4}-\d{2}-\d{2}-(normal|hard)$/u, ""),
    date: typeof raw.date === "string" ? raw.date : "",
    mode,
    guesses: Array.isArray(raw.guesses)
      ? raw.guesses.map(normalizeGuess).filter(Boolean)
      : [],
    completed,
    won: Boolean(raw.won),
    maxGuesses: toNumber(raw.maxGuesses) || (mode === "hard"
      ? GAME_CONFIG.HARD_MODE_MAX_GUESSES
      : GAME_CONFIG.MAX_GUESSES),
    statsApplied: Boolean(raw.statsApplied) || completed,
  };
  if (typeof raw.startTime === "string") {
    game.startTime = raw.startTime;
  }
  if (typeof raw.endTime === "string") {
    game.endTime = raw.endTime;
  }
  return game;
};

const normalizeGames = (raw) => {
  const games = {};
  if (!raw || typeof raw !== "object") {
    return games;
  }
  for (const [key, game] of Object.entries(raw)) {
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }
    const normalized = normalizeGame(key, game);
    if (normalized) {
      games[key] = normalized;
    }
  }
  return games;
};

export const createInitialGame = (region, date, mode) => ({
  region,
  date,
  mode,
  guesses: [],
  completed: false,
  won: false,
  maxGuesses:
    mode === "hard"
      ? GAME_CONFIG.HARD_MODE_MAX_GUESSES
      : GAME_CONFIG.MAX_GUESSES,
  statsApplied: false,
});

export const gameKey = (region, date, mode) => `${region}-${date}-${mode}`;

const buildStats = (stats, region, won, guessCount) => {
  const next = {
    ...stats,
    regionStats: { ...stats.regionStats },
  };
  next.totalGamesPlayed += 1;
  if (won) {
    next.totalGamesWon += 1;
    next.currentStreak += 1;
    next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
  } else {
    next.currentStreak = 0;
  }

  const regionStats = { ...next.regionStats[region] };
  regionStats.gamesPlayed = toNumber(regionStats.gamesPlayed) + 1;
  regionStats.gamesWon = toNumber(regionStats.gamesWon) + (won ? 1 : 0);
  regionStats.totalGuesses = toNumber(regionStats.totalGuesses) + guessCount;
  regionStats.averageGuesses =
    regionStats.gamesPlayed > 0
      ? regionStats.totalGuesses / regionStats.gamesPlayed
      : 0;
  next.regionStats[region] = regionStats;
  return next;
};

const isSingleLegacyGame = (parsed) =>
  Boolean(
    parsed.region &&
      parsed.lastPlayed &&
      !parsed.dailyGames &&
      !parsed.hardModeGames,
  );

const legacyMode = (parsed, defaultMode) =>
  parsed.mode === "hard" || parsed.mode === "normal"
    ? parsed.mode
    : defaultMode;

const importSingleLegacyGame = (target, parsed, defaultMode) => {
  const mode = legacyMode(parsed, defaultMode);
  const key = gameKey(parsed.region, parsed.lastPlayed, mode);
  target.dailyGames[key] = {
    region: parsed.region,
    date: parsed.lastPlayed,
    mode,
    guesses: Array.isArray(parsed.guesses)
      ? parsed.guesses.map(normalizeGuess).filter(Boolean)
      : [],
    completed: Boolean(parsed.completed),
    won: Boolean(parsed.won),
    maxGuesses:
      toNumber(parsed.maxGuesses) ||
      (mode === "hard"
        ? GAME_CONFIG.HARD_MODE_MAX_GUESSES
        : GAME_CONFIG.MAX_GUESSES),
    statsApplied: Boolean(parsed.completed),
    ...(typeof parsed.startTime === "string" ? { startTime: parsed.startTime } : {}),
    ...(typeof parsed.endTime === "string" ? { endTime: parsed.endTime } : {}),
  };
};

const importMultiLegacyGames = (target, parsed, defaultMode) => {
  const games = parsed.hardModeGames || parsed.dailyGames || {};
  for (const [key, game] of Object.entries(games)) {
    if (DANGEROUS_KEYS.has(key) || !game || typeof game !== "object") {
      continue;
    }
    const hasModeSuffix = key.endsWith("-normal") || key.endsWith("-hard");
    const nextKey = hasModeSuffix ? key : `${key}-${defaultMode}`;
    const normalized = normalizeGame(nextKey, {
      ...game,
      mode: defaultMode,
    });
    if (normalized) {
      target.dailyGames[nextKey] = normalized;
    }
  }
};

const importLegacyStore = (target, storageKey, defaultMode, mergeStats) => {
  const raw = readJSON(storageKey, null);
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const parsed =
    raw.state && typeof raw.state === "object" ? raw.state : raw;

  if (isSingleLegacyGame(parsed)) {
    importSingleLegacyGame(target, parsed, defaultMode);
  } else {
    importMultiLegacyGames(target, parsed, defaultMode);
  }

  if (mergeStats && parsed.stats) {
    target.stats = combineStats(target.stats, normalizeStats(parsed.stats));
  }
  return true;
};

const migrateLegacyStores = (target) => {
  const hasOldZustandStores = Boolean(
    readString(STORAGE_KEYS.LEGACY_NORMAL_GAME, null) ||
      readString(STORAGE_KEYS.LEGACY_HARD_MODE, null),
  );
  importLegacyStore(
    target,
    STORAGE_KEYS.LEGACY_GAME_STATE,
    "normal",
    !hasOldZustandStores,
  );
  importLegacyStore(target, STORAGE_KEYS.LEGACY_NORMAL_GAME, "normal", true);
  importLegacyStore(target, STORAGE_KEYS.LEGACY_HARD_MODE, "hard", true);
  removeKey(STORAGE_KEYS.LEGACY_GAME_STATE);
  removeKey(STORAGE_KEYS.LEGACY_NORMAL_GAME);
  removeKey(STORAGE_KEYS.LEGACY_HARD_MODE);
};

const loadState = () => {
  if (cachedState) {
    return cachedState;
  }

  const persisted = readJSON(STORAGE_KEYS.GAME, null);
  const persistedState =
    persisted && typeof persisted === "object" && persisted.state && typeof persisted.state === "object"
      ? persisted.state
      : persisted;
  const version = toNumber(persisted?.version);

  const target = {
    dailyGames: normalizeGames(persistedState?.dailyGames),
    stats: normalizeStats(persistedState?.stats),
  };

  const noGames = Object.keys(target.dailyGames).length === 0;
  if (!persisted || version < VERSION || noGames) {
    migrateLegacyStores(target);
  }

  cachedState = target;
  persistState();
  return cachedState;
};

function persistState() {
  if (!cachedState) {
    return;
  }
  writeJSON(STORAGE_KEYS.GAME, {
    state: cachedState,
    version: VERSION,
  });
}

export const getStats = () => loadState().stats;

export const getAllGames = () => loadState().dailyGames;

export const getDailyGame = (key) => loadState().dailyGames[key];

export const setDailyGame = (key, game) => {
  const state = loadState();
  state.dailyGames[key] = game;
  persistState();
  return game;
};

export const ensureDailyGame = (region, date, mode) => {
  const key = gameKey(region, date, mode);
  const existing = getDailyGame(key);
  if (existing) {
    return existing;
  }
  return setDailyGame(key, createInitialGame(region, date, mode));
};

export const processGuess = (key, guess) => {
  const state = loadState();
  const game = state.dailyGames[key];
  if (!game || game.completed) {
    return game || null;
  }

  const updatedGame = {
    ...game,
    guesses: [...game.guesses, normalizeGuess(guess)].filter(Boolean),
    startTime: game.startTime || new Date().toISOString(),
  };

  if (guess.correct || updatedGame.guesses.length >= updatedGame.maxGuesses) {
    updatedGame.completed = true;
    updatedGame.won = Boolean(guess.correct);
    updatedGame.endTime = new Date().toISOString();
    if (!updatedGame.statsApplied) {
      state.stats = buildStats(
        state.stats,
        updatedGame.region,
        updatedGame.won,
        updatedGame.guesses.length,
      );
      updatedGame.statsApplied = true;
    }
  }

  state.dailyGames[key] = updatedGame;
  persistState();
  return updatedGame;
};

export const resetToday = (region, date) => {
  const state = loadState();
  for (const mode of ["normal", "hard"]) {
    const key = gameKey(region, date, mode);
    const previous = state.dailyGames[key];
    state.dailyGames[key] = {
      ...createInitialGame(region, date, mode),
      statsApplied: Boolean(previous?.statsApplied),
    };
  }
  persistState();
};

export const resetAll = () => {
  cachedState = {
    dailyGames: {},
    stats: createInitialStats(),
  };
  persistState();
};

