// Updated GameLogic.js with deterministic answer generation

import { getTodaysBirdFromDaily, findBirdByHash } from './DailyBirdUtils';
import { hashString } from './HashUtils';
import { GAME_CONFIG } from './Constants';

/**
 * Create a unique key for a region-date combination
 * @param {string} region - Region identifier
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {string} - Unique key for this region-date combination
 */
export const createRegionDateKey = (region, date) => {
  return `${region}-${date}`;
};

/**
 * Create initial game state structure that supports multiple regions and dates
 * @returns {Object} - Initial game state structure
 */
export const createInitialGameState = () => {
  return {
    // Daily games organized by region-date keys
    dailyGames: {},
    // Historical stats for the user
    stats: {
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      regionStats: {} // Stats broken down by region
    },
    // Last played info for quick reference
    lastPlayed: {
      region: null,
      date: null
    },
    // Version for future migrations
    version: 2
  };
};

/**
 * Detect if game state is using old format and needs migration
 * @param {Object} gameState - Game state to check
 * @returns {boolean} - True if state needs migration
 */
const needsMigration = (gameState) => {
  // If no version field, it's definitely old
  if (!gameState.version) return true;
  
  // If version is less than current, needs migration
  if (gameState.version < 2) return true;
  
  // If dailyGames doesn't exist, it's old format
  if (!gameState.dailyGames) return true;
  
  return false;
};

/**
 * Migrate old game state format to new format
 * @param {Object} oldGameState - Old format game state
 * @returns {Object} - Migrated game state
 */
const migrateGameState = (oldGameState) => {
  console.log('Migrating old game state format to new format');
  
  const newGameState = createInitialGameState();
  
  // If old state exists and has some structure, try to preserve what we can
  if (oldGameState && typeof oldGameState === 'object') {
    // Preserve existing stats if they exist
    if (oldGameState.stats) {
      newGameState.stats = {
        ...newGameState.stats,
        ...oldGameState.stats
      };
      
      // Ensure regionStats exists
      if (!newGameState.stats.regionStats) {
        newGameState.stats.regionStats = {};
      }
    }
    
    // Try to migrate old daily game data if it exists
    // This handles various old formats that might exist
    if (oldGameState.guesses || oldGameState.completed !== undefined) {
      // Old format had game data at root level
      const today = new Date().toISOString().split('T')[0];
      const defaultRegion = 'us'; // Assume US region for old games
      
      const migratedGame = createInitialDailyGameState(defaultRegion, today);
      migratedGame.guesses = oldGameState.guesses || [];
      migratedGame.completed = oldGameState.completed || false;
      migratedGame.won = oldGameState.won || false;
      migratedGame.startTime = oldGameState.startTime || new Date().toISOString();
      migratedGame.endTime = oldGameState.endTime || null;
      migratedGame.birdId = oldGameState.birdId || null;
      
      const key = createRegionDateKey(defaultRegion, today);
      newGameState.dailyGames[key] = migratedGame;
      
      newGameState.lastPlayed = {
        region: defaultRegion,
        date: today
      };
    }
    
    // Preserve any other fields that might be useful
    if (oldGameState.lastPlayed) {
      newGameState.lastPlayed = {
        ...newGameState.lastPlayed,
        ...oldGameState.lastPlayed
      };
    }
  }
  
  return newGameState;
};

/**
 * Ensure game state is in the correct format, migrating if necessary
 * @param {Object} gameState - Game state to validate/migrate
 * @returns {Object} - Valid game state in current format
 */
export const ensureGameStateFormat = (gameState) => {
  // If no game state at all, create fresh
  if (!gameState) {
    return createInitialGameState();
  }
  
  // If needs migration, migrate it
  if (needsMigration(gameState)) {
    return migrateGameState(gameState);
  }
  
  // State is current format, return as-is
  return gameState;
};

/**
 * Create initial state for a specific region-date combination
 * @param {string} region - Region identifier
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object} - Initial daily game state
 */
export const createInitialDailyGameState = (region, date) => {
  return {
    region,
    date,
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: GAME_CONFIG.MAX_GUESSES,
    startTime: new Date().toISOString(),
    endTime: null,
    birdId: null // Will be set when the daily bird is determined
  };
};

/**
 * Get the current daily game state for a specific region-date
 * @param {Object} gameState - Main game state object
 * @param {string} region - Region identifier
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object} - Daily game state for this region-date
 */
export const getDailyGameState = (gameState, region, date) => {
  // Ensure game state is in correct format before proceeding
  const validGameState = ensureGameStateFormat(gameState);
  
  const key = createRegionDateKey(region, date);
  
  if (!validGameState.dailyGames[key]) {
    validGameState.dailyGames[key] = createInitialDailyGameState(region, date);
  }
  
  return validGameState.dailyGames[key];
};

/**
 * Check if user has played a specific region-date combination
 * @param {Object} gameState - Main game state object
 * @param {string} region - Region identifier
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {boolean} - True if user has played this combination
 */
export const hasPlayedRegionDate = (gameState, region, date) => {
  const validGameState = ensureGameStateFormat(gameState);
  const key = createRegionDateKey(region, date);
  return validGameState.dailyGames[key] && validGameState.dailyGames[key].guesses.length > 0;
};

/**
 * Process a guess for the current daily game
 * @param {Object} gameState - Main game state object
 * @param {string} region - Region identifier
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} guessedBirdId - ID of the guessed bird
 * @param {string} correctBirdId - ID of the correct bird
 * @returns {Object} - Updated game state
 */
export const processGuess = (gameState, region, date, guessedBirdId, correctBirdId) => {
  // Ensure game state is in correct format
  const validGameState = ensureGameStateFormat(gameState);
  const newGameState = { ...validGameState };
  const dailyGame = getDailyGameState(newGameState, region, date);
  
  // Don't allow guesses if game is already completed
  if (dailyGame.completed) {
    return newGameState;
  }
  
  const isCorrect = guessedBirdId === correctBirdId;
  
  // Add the guess
  const guess = {
    birdId: guessedBirdId,
    correct: isCorrect,
    timestamp: new Date().toISOString()
  };
  
  dailyGame.guesses.push(guess);
  dailyGame.birdId = correctBirdId; // Store the correct answer
  
  // Check if game is completed
  if (isCorrect || dailyGame.guesses.length >= dailyGame.maxGuesses) {
    dailyGame.completed = true;
    dailyGame.won = isCorrect;
    dailyGame.endTime = new Date().toISOString();
    
    // Update overall stats
    updateUserStats(newGameState, region, dailyGame);
  }
  
  // Update last played info
  newGameState.lastPlayed = { region, date };
  
  return newGameState;
};

/**
 * Update user statistics after completing a daily game
 * @param {Object} gameState - Main game state object
 * @param {string} region - Region identifier
 * @param {Object} dailyGame - Completed daily game state
 */
const updateUserStats = (gameState, region, dailyGame) => {
  const stats = gameState.stats;
  
  // Update overall stats
  stats.totalGamesPlayed++;
  if (dailyGame.won) {
    stats.totalGamesWon++;
  }
  
  // Update average guesses
  const totalGuesses = Object.values(gameState.dailyGames)
    .filter(game => game.completed)
    .reduce((sum, game) => sum + game.guesses.length, 0);
  stats.averageGuesses = totalGuesses / stats.totalGamesPlayed;
  
  // Update streaks (simplified - you might want more complex logic)
  if (dailyGame.won) {
    stats.currentStreak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }
  
  // Update region-specific stats
  if (!stats.regionStats[region]) {
    stats.regionStats[region] = {
      gamesPlayed: 0,
      gamesWon: 0,
      averageGuesses: 0
    };
  }
  
  const regionStats = stats.regionStats[region];
  regionStats.gamesPlayed++;
  if (dailyGame.won) {
    regionStats.gamesWon++;
  }
  
  // Calculate region-specific average
  const regionTotalGuesses = Object.values(gameState.dailyGames)
    .filter(game => game.completed && game.region === region)
    .reduce((sum, game) => sum + game.guesses.length, 0);
  regionStats.averageGuesses = regionTotalGuesses / regionStats.gamesPlayed;
};

/**
 * Get today's bird with region-date awareness
 * @param {string} region - Region identifier
 * @param {Array} birds - Array of birds for the region
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object|null} - Today's bird or null
 */
export const getDailyBird = (region, birds, date) => {
  // This is a fallback synchronous method if the async version fails
  // You might want to implement a hash-based selection here as fallback
  if (!birds || birds.length === 0) return null;
  
  // Simple hash-based selection as fallback
  const seed = hashString(`${region}-${date}`);
  const index = Math.abs(seed) % birds.length;
  return birds[index];
};

/**
 * Get today's bird with fallback support
 * @param {string} region - Region identifier
 * @param {Array} birds - Array of birds for the region
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Promise<Object|null>} - Promise resolving to today's bird
 */
export const getDailyBirdWithFallback = async (region, birds, date) => {
  try {
    // First try to get from daily.json
    const bird = await getTodaysBirdFromDaily(region, birds, date);
    if (bird) return bird;
    
    // Fallback to hash-based selection
    console.log(`Falling back to hash-based selection for ${region} on ${date}`);
    return getDailyBird(region, birds, date);
  } catch (error) {
    console.error('Error in getDailyBirdWithFallback:', error);
    return getDailyBird(region, birds, date);
  }
};

/**
 * Deterministic random number generator using a seed
 * @param {number} seed - Seed value for deterministic randomness
 * @returns {function} - Function that returns deterministic "random" numbers between 0 and 1
 */
const createSeededRandom = (seed) => {
  let state = seed;
  return () => {
    // Linear congruential generator - simple but effective for our needs
    state = (state * 1664525 + 1013904223) >>> 0; // Keep it 32-bit
    return (state % 2147483647) / 2147483647; // Normalize to 0-1
  };
};

/**
 * Shuffle array deterministically using seeded random
 * @param {Array} array - Array to shuffle
 * @param {number} seed - Seed for deterministic shuffling
 * @returns {Array} - New shuffled array
 */
const deterministicShuffle = (array, seed) => {
  const shuffled = [...array];
  const random = createSeededRandom(seed);
  
  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

/**
 * Generate deterministic answer options for the daily game
 * @param {string} region - Region identifier
 * @param {Object} birds - Birds data object
 * @param {string} date - Date string
 * @param {Object} correctBird - The correct bird for today
 * @param {number} optionCount - Number of options to generate
 * @returns {Array} - Array of bird options including the correct answer
 */
export const generateAnswerOptions = (region, birds, date, correctBird, optionCount = 4) => {
  if (!birds[region] || !correctBird) return [];
  
  const regionBirds = birds[region];
  
  // Create a seed based on region, date, and correct bird ID for deterministic selection
  const seed = hashString(`${region}-${date}-${correctBird.id}-options`);
  const random = createSeededRandom(seed);
  
  // Get birds that aren't the correct answer
  const availableBirds = regionBirds.filter(bird => bird.id !== correctBird.id);
  
  // First, try to get birds from the same family as the correct bird
  const sameFamilyBirds = availableBirds.filter(bird => bird.family === correctBird.family);
  
  let selectedWrongBirds = [];
  
  if (sameFamilyBirds.length >= optionCount - 1) {
    // We have enough birds from the same family
    const shuffledSameFamily = deterministicShuffle(sameFamilyBirds, seed);
    selectedWrongBirds = shuffledSameFamily.slice(0, optionCount - 1);
  } else {
    // Not enough birds from same family, use all available same-family birds
    // and fill the rest from the entire available list
    const shuffledSameFamily = deterministicShuffle(sameFamilyBirds, seed);
    selectedWrongBirds = [...shuffledSameFamily];
    
    // Get remaining birds (excluding same family birds and correct bird)
    const remainingBirds = availableBirds.filter(bird => bird.family !== correctBird.family);
    const shuffledRemaining = deterministicShuffle(remainingBirds, seed);
    
    // Add birds from other families to reach the desired count
    const stillNeeded = optionCount - 1 - selectedWrongBirds.length;
    for (let i = 0; i < Math.min(stillNeeded, shuffledRemaining.length); i++) {
      selectedWrongBirds.push(shuffledRemaining[i]);
    }
  }
  
  // Combine correct answer with wrong answers
  const allOptions = [correctBird, ...selectedWrongBirds];
  
  // Shuffle all options deterministically so correct answer position is consistent
  // Use a different seed component for final shuffle to avoid patterns
  const finalSeed = hashString(`${region}-${date}-${correctBird.id}-final`);
  const finalOptions = deterministicShuffle(allOptions, finalSeed);
  
  return finalOptions;
};

/**
 * Get user's performance summary
 * @param {Object} gameState - Main game state object
 * @returns {Object} - Performance summary
 */
export const getUserPerformanceSummary = (gameState) => {
  const validGameState = ensureGameStateFormat(gameState);
  const stats = validGameState.stats;
  
  return {
    totalGames: stats.totalGamesPlayed,
    winRate: stats.totalGamesPlayed > 0 ? (stats.totalGamesWon / stats.totalGamesPlayed * 100).toFixed(1) : 0,
    averageGuesses: stats.averageGuesses.toFixed(1),
    currentStreak: stats.currentStreak,
    maxStreak: stats.maxStreak,
    regionBreakdown: Object.entries(stats.regionStats).map(([region, regionStats]) => ({
      region,
      games: regionStats.gamesPlayed,
      winRate: regionStats.gamesPlayed > 0 ? (regionStats.gamesWon / regionStats.gamesPlayed * 100).toFixed(1) : 0,
      avgGuesses: regionStats.averageGuesses.toFixed(1)
    }))
  };
};