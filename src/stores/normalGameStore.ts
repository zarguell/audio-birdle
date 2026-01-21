import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Daily game state structure for a specific region-date combination
 */
export interface DailyGame {
  region: string;
  date: string;
  guesses: Array<{
    birdId: string;
    correct: boolean;
    timestamp: number;
  }>;
  completed: boolean;
  won: boolean;
  maxGuesses: number;
  startTime?: string;
  endTime?: string;
}

/**
 * Region-specific statistics
 */
export interface RegionStats {
  gamesPlayed: number;
  gamesWon: number;
  totalGuesses: number;
  averageGuesses: number;
}

/**
 * Overall game statistics
 */
export interface GameStats {
  totalGamesPlayed: number;
  totalGamesWon: number;
  currentStreak: number;
  maxStreak: number;
  regionStats: Record<string, RegionStats>;
}

/**
 * Normal game store state
 */
export interface NormalGameState {
  dailyGames: Record<string, DailyGame>;
  stats: GameStats;
}

/**
 * Normal game store actions
 */
export interface NormalGameActions {
  setDailyGame: (key: string, game: DailyGame) => void;
  getDailyGame: (key: string) => DailyGame | undefined;
  processGuess: (key: string, guess: { birdId: string; correct: boolean; timestamp: number }) => void;
  updateStats: (region: string, won: boolean, guesses: number) => void;
  reset: () => void;
  migrateFromOldFormat: () => void;
}

/**
 * Create initial game stats
 */
const createInitialStats = (): GameStats => ({
  totalGamesPlayed: 0,
  totalGamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  regionStats: {},
});

/**
 * Helper function to update stats when a game completes
 */
function updateStats(state: any, region: string, won: boolean, guesses: number): GameStats {
  const newStats = { ...state.stats };

  newStats.totalGamesPlayed++;
  if (won) {
    newStats.totalGamesWon++;
    newStats.currentStreak++;
    newStats.maxStreak = Math.max(newStats.maxStreak, newStats.currentStreak);
  } else {
    newStats.currentStreak = 0;
  }

  if (!newStats.regionStats[region]) {
    newStats.regionStats[region] = {
      gamesPlayed: 0,
      gamesWon: 0,
      totalGuesses: 0,
      averageGuesses: 0,
    };
  }

  const regionStats = newStats.regionStats[region];
  regionStats.totalGuesses += guesses;
  regionStats.gamesPlayed++;
  regionStats.averageGuesses = regionStats.totalGuesses / regionStats.gamesPlayed;

  if (won) {
    regionStats.gamesWon++;
  }

  return newStats;
}

/**
 * Migration function for old localStorage format to version 2
 */
const migrateGameState = (persistedState: any, version: number): any => {
  // If it's already version 2 or higher, return as-is
  if (version >= 2) {
    return persistedState;
  }

  // Migrate from old format (version 0 or 1)
  console.log('Migrating normal game state from version', version, 'to version 2');

  const newState: NormalGameState = {
    dailyGames: persistedState.dailyGames || {},
    stats: persistedState.stats || createInitialStats(),
  };

  return newState;
};

/**
 * Normal Game Store
 *
 * Manages state for normal mode games with localStorage persistence
 * Supports multi-region, multi-date game tracking
 */
export const useNormalGameStore = create<NormalGameState & NormalGameActions>()(
  persist(
    (set, get) => ({
      // Initial state
      dailyGames: {},
      stats: createInitialStats(),

      // Actions

      /**
       * Set or update a daily game
       */
      setDailyGame: (key: string, game: DailyGame) =>
        set((state) => ({
          dailyGames: {
            ...state.dailyGames,
            [key]: game,
          },
        })),

      /**
       * Get daily game for a specific key
       */
      getDailyGame: (key: string): DailyGame | undefined => {
        const state = get();
        return state.dailyGames[key];
      },

       /**
        * Process a guess for the current daily game
        */
        processGuess: (key: string, guess: { birdId: string; correct: boolean; timestamp: number }) => {
         set((state) => {
           const dailyGame = state.dailyGames[key];
           if (!dailyGame) {
             console.warn(`Game ${key} not found`);
             return state;
           }

           // Don't allow guesses if game is already completed
           if (dailyGame.completed) {
             return state;
           }

           const updatedGame = {
             ...dailyGame,
             guesses: [...dailyGame.guesses, guess],
             startTime: dailyGame.startTime || new Date().toISOString(),
           };

           // Check if game is completed and update stats accordingly
           if (guess.correct || updatedGame.guesses.length >= updatedGame.maxGuesses) {
             updatedGame.completed = true;
             updatedGame.won = guess.correct;
             updatedGame.endTime = new Date().toISOString();

             // Update stats only when game completes
             return {
               dailyGames: {
                 ...state.dailyGames,
                 [key]: updatedGame,
               },
               stats: updateStats(state, dailyGame.region, updatedGame.won, updatedGame.guesses.length),
             };
           }

           return {
             dailyGames: {
               ...state.dailyGames,
               [key]: updatedGame,
             },
           };
         });
       },

      /**
       * Update user statistics after completing a daily game
       */
      updateStats: (region: string, won: boolean, guesses: number) => {
        set((state) => {
          const newStats = { ...state.stats };

          newStats.totalGamesPlayed++;
          if (won) {
            newStats.totalGamesWon++;
            newStats.currentStreak++;
            newStats.maxStreak = Math.max(newStats.maxStreak, newStats.currentStreak);
          } else {
            newStats.currentStreak = 0;
          }

          if (!newStats.regionStats[region]) {
            newStats.regionStats[region] = {
              gamesPlayed: 0,
              gamesWon: 0,
              totalGuesses: 0,
              averageGuesses: 0,
            };
          }

          const regionStats = newStats.regionStats[region];
          regionStats.totalGuesses += guesses;
          regionStats.gamesPlayed++;
          regionStats.averageGuesses = regionStats.totalGuesses / regionStats.gamesPlayed;

          if (won) {
            regionStats.gamesWon++;
          }

          return { stats: newStats };
        });
      },

      /**
       * Reset store to initial state (useful for testing)
       */
      reset: () =>
        set(() => ({
          dailyGames: {},
          stats: createInitialStats(),
        })),

      /**
       * Migrate from old localStorage format (audio-birdle-game-state key)
       * Reads from the old v1/v0 format and converts to v2 multi-region format
       */
      migrateFromOldFormat: () => {
        const OLD_STORAGE_KEY = 'audio-birdle-game-state';
        const oldState = localStorage.getItem(OLD_STORAGE_KEY);

        if (!oldState) {
          console.log('No old game state found to migrate');
          return;
        }

        try {
          const parsed = JSON.parse(oldState);
          console.log('Migrating old normal game state:', parsed);

          let newDailyGames: Record<string, DailyGame> = {};
          let newStats = createInitialStats();

          // Handle version 0 (single game format before multi-region support)
          if (parsed.region && parsed.lastPlayed && !parsed.dailyGames) {
            const key = `${parsed.region}-${parsed.lastPlayed}`;
            const migratedGame: DailyGame = {
              region: parsed.region,
              date: parsed.lastPlayed,
              guesses: parsed.guesses || [],
              completed: parsed.completed || false,
              won: parsed.won || false,
              maxGuesses: parsed.maxGuesses || 4,
            };

            // Preserve optional fields if present
            if (parsed.startTime) migratedGame.startTime = parsed.startTime;
            if (parsed.endTime) migratedGame.endTime = parsed.endTime;

            newDailyGames = {
              [key]: migratedGame,
            };

            // Migrate stats if they exist
            if (parsed.stats) {
              newStats = {
                totalGamesPlayed: parsed.stats.totalGamesPlayed || 0,
                totalGamesWon: parsed.stats.totalGamesWon || 0,
                currentStreak: parsed.stats.currentStreak || 0,
                maxStreak: parsed.stats.maxStreak || 0,
                regionStats: parsed.stats.regionStats || {},
              };
            }

            console.log('Migrated v0 state to v2:', { newDailyGames, newStats });
          }
          // Handle version 1 (already has dailyGames)
          else if (parsed.dailyGames) {
            newDailyGames = parsed.dailyGames;

            // Migrate stats if they exist
            if (parsed.stats) {
              newStats = {
                totalGamesPlayed: parsed.stats.totalGamesPlayed || 0,
                totalGamesWon: parsed.stats.totalGamesWon || 0,
                currentStreak: parsed.stats.currentStreak || 0,
                maxStreak: parsed.stats.maxStreak || 0,
                regionStats: parsed.stats.regionStats || {},
              };
            }

            console.log('Migrated v1 state to v2:', { newDailyGames, newStats });
          }

          // Update store with migrated data
          set({
            dailyGames: newDailyGames,
            stats: newStats,
          });

          // Clean up old localStorage key after successful migration
          // We keep it as backup for now - can be removed in future phase
          console.log('Migration complete. Old key preserved as backup:', OLD_STORAGE_KEY);
        } catch (error) {
          console.error('Failed to migrate old normal game state:', error);
          // Don't delete old state if migration failed - user can try again
        }
      },
    }),
    {
      name: 'audio-birdle-normal-game',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: migrateGameState,
      onRehydrateStorage: () => (state) => {
        console.log('Normal game store rehydrated', state);
      },
    }
  )
);
