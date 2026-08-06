// Updated GameLogic.js with deterministic answer generation
// Now delegates to unified Zustand store for all state management

import { getTodaysBirdFromDaily } from "./DailyBirdUtils";
import { hashString, deterministicShuffle } from "./HashUtils";
import { GAME_CONFIG } from "./Constants";
import { compareTaxonomy } from "./TaxonomyUtils";
import { useGameStore } from "../stores/gameStore";

/**
 * @deprecated The app uses the Zustand store (useGameStore) with its own key
 * scheme. Kept exported only because tests exercise it.
 * @param {string} region - Region identifier
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {string} `${region}-${date}` composite key
 */
export const createRegionDateKey = (region, date) => {
  return `${region}-${date}`;
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const getDailyGameState = (gameState, region, date) => {
  const key = `${region}-${date}-normal`;
  const storeGame = useGameStore.getState().getDailyGame(key);

  if (storeGame) {
    return storeGame;
  }

  const initialGame = {
    region,
    date,
    mode: "normal",
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: GAME_CONFIG.MAX_GUESSES,
  };

  useGameStore.getState().setDailyGame(key, initialGame);
  return initialGame;
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const hasPlayedRegionDate = (gameState, region, date) => {
  const key = `${region}-${date}-normal`;

  const storeGame = useGameStore.getState().getDailyGame(key);
  if (storeGame && storeGame.guesses.length > 0) {
    return true;
  }

  return gameState?.dailyGames?.[key]?.guesses?.length > 0;
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const processGuess = (
  gameState,
  region,
  date,
  guessedBirdId,
  correctBirdId,
) => {
  const key = `${region}-${date}-normal`;
  const isCorrect = guessedBirdId === correctBirdId;

  if (gameState && gameState.dailyGames && gameState.dailyGames[key]) {
    useGameStore.getState().setDailyGame(key, gameState.dailyGames[key]);
  } else {
    const existingGame = useGameStore.getState().getDailyGame(key);
    if (!existingGame) {
      const initialGame = {
        region,
        date,
        mode: "normal",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: GAME_CONFIG.MAX_GUESSES,
      };
      useGameStore.getState().setDailyGame(key, initialGame);
    }
  }

  useGameStore.getState().processGuess(key, {
    birdId: guessedBirdId,
    correct: isCorrect,
    timestamp: Date.now(),
  });

  const allDailyGames = useGameStore.getState().dailyGames;
  const storeStats = useGameStore.getState().stats;

  return {
    dailyGames: allDailyGames,
    stats: storeStats,
    version: 2,
  };
};

/**
 * Deterministic hash-based daily bird selection.
 * Public and documented: this is the offline/out-of-sync fallback for
 * getDailyBirdWithFallback and is used for practice/preview modes.
 * @param {string} region - The selected region
 * @param {Array} birds - Array of birds for the region
 * @param {string} date - Current date string (YYYY-MM-DD)
 * @returns {Object|null} A bird from the array, or null if birds is empty
 */
export const getDailyBird = (region, birds, date) => {
  if (!birds || birds.length === 0) return null;

  const hash = hashString(`${region}-${date}`);
  const seed = parseInt(hash, 16);
  const index = Math.abs(seed) % birds.length;
  return birds[index];
};

/**
 * Get today's bird, preferring the daily.json entry and falling back to
 * deterministic hash selection (getDailyBird) when daily data is unavailable
 * (offline) or out of sync (no matching entry).
 * @param {string} region - The selected region
 * @param {Array} birds - Array of birds for the region
 * @param {string} date - Current date string (YYYY-MM-DD)
 * @returns {Promise<{bird: Object|null, success: boolean, error: string|null, message: string|null, usedFallback: boolean}>}
 */
export const getDailyBirdWithFallback = async (region, birds, date) => {
  try {
    const result = await getTodaysBirdFromDaily(region, birds, date);

    if (result.success && result.bird) {
      return {
        bird: result.bird,
        success: true,
        error: null,
        message: null,
        usedFallback: false,
      };
    }

    // Daily data unavailable (network) or out of sync (not_found):
    // fall back to deterministic hash-based selection so the game still works.
    const fallbackBird = getDailyBird(region, birds, date);
    if (fallbackBird) {
      const isNetwork = result.error === "network";
      return {
        bird: fallbackBird,
        success: true,
        error: null,
        message: isNetwork
          ? "Offline mode: using hash-based selection"
          : "Daily data out of sync — using hash-based selection",
        usedFallback: true,
      };
    }

    const isNetwork = result.error === "network";
    return {
      bird: null,
      success: false,
      error: isNetwork ? "network" : "not_found",
      message: isNetwork
        ? "Failed to load daily challenge. Please check your connection."
        : "Daily challenge data is out of sync. A refresh is needed.",
      usedFallback: false,
    };
  } catch (error) {
    console.error("Error in getDailyBirdWithFallback:", error);
    return {
      bird: null,
      success: false,
      error: "fetch_failed",
      message: "Failed to load daily challenge. Please check your connection.",
      usedFallback: false,
    };
  }
};

export const generateAnswerOptions = (
  region,
  birds,
  date,
  correctBird,
  optionCount = 4,
) => {
  if (!birds[region] || !correctBird) return [];

  const regionBirds = birds[region];

  const seed = hashString(`${region}-${date}-${correctBird.id}-options`);

  const availableBirds = regionBirds.filter(
    (bird) => bird.id !== correctBird.id,
  );

  const sameFamilyBirds = availableBirds.filter(
    (bird) => bird.family === correctBird.family,
  );

  let selectedWrongBirds;

  if (sameFamilyBirds.length >= optionCount - 1) {
    const shuffledSameFamily = deterministicShuffle(sameFamilyBirds, seed);
    selectedWrongBirds = shuffledSameFamily.slice(0, optionCount - 1);
  } else {
    const shuffledSameFamily = deterministicShuffle(sameFamilyBirds, seed);
    selectedWrongBirds = [...shuffledSameFamily];

    const remainingBirds = availableBirds.filter(
      (bird) => bird.family !== correctBird.family,
    );
    const shuffledRemaining = deterministicShuffle(remainingBirds, seed);

    const stillNeeded = optionCount - 1 - selectedWrongBirds.length;
    for (let i = 0; i < Math.min(stillNeeded, shuffledRemaining.length); i++) {
      selectedWrongBirds.push(shuffledRemaining[i]);
    }
  }

  const allOptions = [correctBird, ...selectedWrongBirds];

  const finalSeed = hashString(`${region}-${date}-${correctBird.id}-final`);
  const finalOptions = deterministicShuffle(allOptions, finalSeed);

  return finalOptions;
};

// ============================================================================
// HARD MODE FUNCTIONS
// ============================================================================

export const createInitialHardModeGameState = (region, date) => {
  return {
    region,
    date,
    mode: "hard",
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: GAME_CONFIG.HARD_MODE_MAX_GUESSES,
    startTime: new Date().toISOString(),
    endTime: null,
    birdId: null,
  };
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const getHardModeGameState = (gameState, region, date) => {
  const key = `${region}-${date}-hard`;
  const storeGame = useGameStore.getState().getDailyGame(key);

  if (storeGame) {
    return storeGame;
  }

  const initialGame = {
    region,
    date,
    mode: "hard",
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: GAME_CONFIG.HARD_MODE_MAX_GUESSES,
  };

  useGameStore.getState().setDailyGame(key, initialGame);
  return initialGame;
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const processHardModeGuess = (
  gameState,
  region,
  date,
  guessedBird,
  textInput,
  correctBird,
) => {
  const key = `${region}-${date}-hard`;

  const taxonomicScore = compareTaxonomy(guessedBird, correctBird);
  const isCorrect = guessedBird.id === correctBird.id;

  if (gameState && gameState.dailyGames && gameState.dailyGames[key]) {
    useGameStore.getState().setDailyGame(key, gameState.dailyGames[key]);
  } else {
    const existingGame = useGameStore.getState().getDailyGame(key);
    if (!existingGame) {
      const initialGame = {
        region,
        date,
        mode: "hard",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: GAME_CONFIG.HARD_MODE_MAX_GUESSES,
      };
      useGameStore.getState().setDailyGame(key, initialGame);
    }
  }

  useGameStore.getState().processGuess(key, {
    birdId: guessedBird.id,
    textInput,
    correct: isCorrect,
    timestamp: Date.now(),
    taxonomicScore,
  });

  const updatedGame = useGameStore.getState().getDailyGame(key);
  const storeStats = useGameStore.getState().stats;

  return {
    dailyGames: {
      [key]: updatedGame,
    },
    stats: storeStats,
    version: 2,
  };
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const hasPlayedHardModeRegionDate = (gameState, region, date) => {
  const key = `${region}-${date}-hard`;

  const storeGame = useGameStore.getState().getDailyGame(key);
  if (storeGame && storeGame.guesses.length > 0) {
    return true;
  }

  if (!gameState.dailyGames) {
    return false;
  }
  return gameState.dailyGames[key]?.guesses.length > 0;
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const hasCompletedNormalMode = (gameState, region, date) => {
  const key = `${region}-${date}-normal`;

  const storeGame = useGameStore.getState().getDailyGame(key);
  if (storeGame?.completed === true) {
    return true;
  }

  return gameState?.dailyGames?.[key]?.completed === true;
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const hasCompletedHardMode = (gameState, region, date) => {
  const key = `${region}-${date}-hard`;

  const storeGame = useGameStore.getState().getDailyGame(key);
  if (storeGame?.completed === true) {
    return true;
  }

  if (!gameState.dailyGames) {
    return false;
  }
  return gameState.dailyGames[key]?.completed === true;
};

/**
 * @deprecated The app uses the Zustand store (useGameStore). Kept exported
 * only because tests exercise it.
 */
export const getUserPerformanceSummary = (gameState) => {
  const stats = gameState?.stats || useGameStore.getState().stats;

  const totalGuesses = Object.values(stats.regionStats).reduce(
    (sum, region) => sum + region.totalGuesses,
    0,
  );
  const averageGuesses =
    stats.totalGamesPlayed > 0 ? totalGuesses / stats.totalGamesPlayed : 0;

  return {
    totalGames: stats.totalGamesPlayed,
    winRate:
      stats.totalGamesPlayed > 0
        ? ((stats.totalGamesWon / stats.totalGamesPlayed) * 100).toFixed(1)
        : 0,
    averageGuesses: averageGuesses.toFixed(1),
    currentStreak: stats.currentStreak,
    maxStreak: stats.maxStreak,
    regionBreakdown: Object.entries(stats.regionStats).map(
      ([region, regionStats]) => ({
        region,
        games: regionStats.gamesPlayed,
        winRate:
          regionStats.gamesPlayed > 0
            ? ((regionStats.gamesWon / regionStats.gamesPlayed) * 100).toFixed(
                1,
              )
            : 0,
        avgGuesses: (regionStats.averageGuesses || 0).toFixed(1),
      }),
    ),
  };
};
