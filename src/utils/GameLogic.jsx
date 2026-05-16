// Updated GameLogic.js with deterministic answer generation
// Now delegates to unified Zustand store for all state management

import { getTodaysBirdFromDaily } from "./DailyBirdUtils";
import { hashString, deterministicShuffle } from "./HashUtils";
import { GAME_CONFIG } from "./Constants";
import { compareTaxonomy } from "./TaxonomyUtils";
import { useGameStore } from "../stores/gameStore";

export const createRegionDateKey = (region, date) => {
  return `${region}-${date}`;
};

export const createInitialGameState = () => {
  return {
    dailyGames: {},
    stats: {
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      regionStats: {},
    },
    lastPlayed: {
      region: null,
      date: null,
    },
    version: 2,
  };
};

const needsMigration = (gameState) => {
  if (!gameState.version) return true;
  if (gameState.version < 2) return true;
  if (!gameState.dailyGames) return true;
  return false;
};

const migrateGameState = (oldGameState) => {
  console.log("Migrating old game state format to new format");

  const newGameState = createInitialGameState();

  if (oldGameState && typeof oldGameState === "object") {
    if (oldGameState.stats) {
      newGameState.stats = {
        ...newGameState.stats,
        ...oldGameState.stats,
      };

      if (!newGameState.stats.regionStats) {
        newGameState.stats.regionStats = {};
      }
    }

    if (oldGameState.guesses || oldGameState.completed !== undefined) {
      const today = new Date().toISOString().split("T")[0];
      const defaultRegion = "us";

      const migratedGame = createInitialDailyGameState(defaultRegion, today);
      migratedGame.guesses = oldGameState.guesses || [];
      migratedGame.completed = oldGameState.completed || false;
      migratedGame.won = oldGameState.won || false;
      migratedGame.startTime =
        oldGameState.startTime || new Date().toISOString();
      migratedGame.endTime = oldGameState.endTime || null;
      migratedGame.birdId = oldGameState.birdId || null;

      const key = createRegionDateKey(defaultRegion, today);
      newGameState.dailyGames[key] = migratedGame;

      newGameState.lastPlayed = {
        region: defaultRegion,
        date: today,
      };
    }

    if (oldGameState.lastPlayed) {
      newGameState.lastPlayed = {
        ...newGameState.lastPlayed,
        ...oldGameState.lastPlayed,
      };
    }
  }

  return newGameState;
};

export const ensureGameStateFormat = (gameState) => {
  if (!gameState) {
    return createInitialGameState();
  }

  if (needsMigration(gameState)) {
    return migrateGameState(gameState);
  }

  return gameState;
};

export const createInitialDailyGameState = (region, date) => {
  return {
    region,
    date,
    mode: 'normal',
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: GAME_CONFIG.MAX_GUESSES,
    startTime: new Date().toISOString(),
    endTime: null,
    birdId: null,
  };
};

export const getDailyGameState = (gameState, region, date) => {
  const key = `${region}-${date}-normal`;
  const storeGame = useGameStore.getState().getDailyGame(key);

  if (storeGame) {
    return storeGame;
  }

  const initialGame = {
    region,
    date,
    mode: 'normal',
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: GAME_CONFIG.MAX_GUESSES,
  };

  useGameStore.getState().setDailyGame(key, initialGame);
  return initialGame;
};

export const hasPlayedRegionDate = (gameState, region, date) => {
  const key = `${region}-${date}-normal`;

  const storeGame = useGameStore.getState().getDailyGame(key);
  if (storeGame && storeGame.guesses.length > 0) {
    return true;
  }

  const validGameState = ensureGameStateFormat(gameState);
  return validGameState.dailyGames[key]?.guesses.length > 0;
};

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
        mode: 'normal',
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

/* eslint-disable no-unused-vars */
const updateUserStats = (gameState, region, dailyGame) => {
  const stats = gameState.stats;

  stats.totalGamesPlayed++;
  if (dailyGame.won) {
    stats.totalGamesWon++;
  }

  const totalGuesses = Object.values(gameState.dailyGames)
    .filter((game) => game.completed)
    .reduce((sum, game) => sum + game.guesses.length, 0);
  stats.averageGuesses = totalGuesses / stats.totalGamesPlayed;

  if (dailyGame.won) {
    stats.currentStreak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }

  if (!stats.regionStats[region]) {
    stats.regionStats[region] = {
      gamesPlayed: 0,
      gamesWon: 0,
      averageGuesses: 0,
    };
  }

  const regionStats = stats.regionStats[region];
  regionStats.gamesPlayed++;
  if (dailyGame.won) {
    regionStats.gamesWon++;
  }

  const regionTotalGuesses = Object.values(gameState.dailyGames)
    .filter((game) => game.completed && game.region === region)
    .reduce((sum, game) => sum + game.guesses.length, 0);
  regionStats.averageGuesses = regionTotalGuesses / regionStats.gamesPlayed;
};

export const getDailyBird = (region, birds, date) => {
  if (!birds || birds.length === 0) return null;

  const hash = hashString(`${region}-${date}`);
  const seed = parseInt(hash, 16);
  const index = Math.abs(seed) % birds.length;
  return birds[index];
};

export const getDailyBirdWithFallback = async (region, birds, date) => {
  try {
    const bird = await getTodaysBirdFromDaily(region, birds, date);
    if (bird) {
      return { bird, success: true, error: null, message: null };
    }

    console.error(
      `Daily bird lookup failed for ${region} on ${date} - no matching bird found`,
    );
    return {
      bird: null,
      success: false,
      error: "hash_not_found",
      message: "Daily challenge data is out of sync. A refresh is needed.",
    };
  } catch (error) {
    console.error("Error in getDailyBirdWithFallback:", error);
    return {
      bird: null,
      success: false,
      error: "fetch_failed",
      message: "Failed to load daily challenge. Please check your connection.",
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

export const hasCompletedNormalMode = (gameState, region, date) => {
  const key = `${region}-${date}-normal`;

  const storeGame = useGameStore.getState().getDailyGame(key);
  if (storeGame?.completed === true) {
    return true;
  }

  const validGameState = ensureGameStateFormat(gameState);
  return validGameState.dailyGames[key]?.completed === true;
};

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
