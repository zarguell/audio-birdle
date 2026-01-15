import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Taxonomic score for hard mode guesses
 */
export interface TaxonomicScore {
  order: boolean;
  family: boolean;
  genus: boolean;
  species: boolean;
}

/**
 * Hard mode guess with taxonomic feedback
 */
export interface HardModeGuess {
  birdId: string;
  textInput: string;
  correct: boolean;
  timestamp: number;
  taxonomicScore: TaxonomicScore;
}

/**
 * Hard mode daily game state
 */
export interface HardModeDailyGame {
  region: string;
  date: string;
  mode: 'hard';
  guesses: HardModeGuess[];
  completed: boolean;
  won: boolean;
  maxGuesses: number;
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
 * Overall hard mode statistics
 */
export interface HardModeGameStats {
  totalGamesPlayed: number;
  totalGamesWon: number;
  currentStreak: number;
  maxStreak: number;
  regionStats: Record<string, RegionStats>;
}

/**
 * Hard mode store state
 */
export interface HardModeState {
  hardModeGames: Record<string, HardModeDailyGame>;
  stats: HardModeGameStats;
}

/**
 * Hard mode store actions
 */
export interface HardModeActions {
  setHardModeGame: (key: string, game: HardModeDailyGame) => void;
  getHardModeGame: (key: string) => HardModeDailyGame | undefined;
  processHardModeGuess: (key: string, guess: HardModeGuess) => void;
  updateHardModeStats: (region: string, won: boolean, guesses: number) => void;
  reset: () => void;
  migrateFromOldFormat: () => void;
}

/**
 * Create initial hard mode stats
 */
const createInitialStats = (): HardModeGameStats => ({
  totalGamesPlayed: 0,
  totalGamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  regionStats: {},
});

/**
 * Helper function to update stats when a game completes
 */
function updateStats(state: any, region: string, won: boolean, guesses: number): HardModeGameStats {
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
const migrateHardModeState = (persistedState: any, version: number): any => {
  // If it's already version 2 or higher, return as-is
  if (version >= 2) {
    return persistedState;
  }

  // Migrate from old format (version 0 or 1)
  console.log('Migrating hard mode state from version', version, 'to version 2');

  const newState: HardModeState = {
    hardModeGames: persistedState.hardModeGames || {},
    stats: persistedState.stats || createInitialStats(),
  };

  return newState;
};

/**
 * Hard Mode Store
 *
 * Manages state for hard mode games with localStorage persistence
 * Features taxonomic feedback and free-text input
 */
export const useHardModeStore = create<HardModeState & HardModeActions>()(
  persist(
    (set, get) => ({
      // Initial state
      hardModeGames: {},
      stats: createInitialStats(),

      // Actions

      /**
       * Set or update a hard mode game
       */
      setHardModeGame: (key: string, game: HardModeDailyGame) =>
        set((state) => ({
          hardModeGames: {
            ...state.hardModeGames,
            [key]: game,
          },
        })),

      /**
       * Get hard mode game for a specific key
       */
      getHardModeGame: (key: string): HardModeDailyGame | undefined => {
        const state = get();
        return state.hardModeGames[key];
      },

      /**
       * Process a hard mode guess with taxonomic feedback
       */
       processHardModeGuess: (key: string, guess: HardModeGuess) => {
        set((state) => {
          const hardModeGame = state.hardModeGames[key];
          if (!hardModeGame) {
            console.warn(`Hard mode game ${key} not found`);
            return state;
          }

          // Don't allow guesses if game is already completed
          if (hardModeGame.completed) {
            return state;
          }

          const updatedGame = {
            ...hardModeGame,
            guesses: [...hardModeGame.guesses, guess],
          };

          // Check if game is completed and update stats accordingly
          if (guess.correct || updatedGame.guesses.length >= updatedGame.maxGuesses) {
            updatedGame.completed = true;
            updatedGame.won = guess.correct;

            // Update stats only when game completes
            return {
              hardModeGames: {
                ...state.hardModeGames,
                [key]: updatedGame,
              },
              stats: updateStats(state, hardModeGame.region, updatedGame.won, updatedGame.guesses.length),
            };
          }

          return {
            hardModeGames: {
              ...state.hardModeGames,
              [key]: updatedGame,
            },
          };
        });
      },

      /**
       * Update hard mode statistics after completing a game
       */
      updateHardModeStats: (region: string, won: boolean, guesses: number) => {
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
          hardModeGames: {},
          stats: createInitialStats(),
        })),

      /**
       * Migrate from old localStorage format
       */
      migrateFromOldFormat: () => {
        const oldState = localStorage.getItem('audio-birdle-hard-mode');
        if (!oldState) {
          return;
        }

        try {
          const parsed = JSON.parse(oldState);

          // Handle version 0 (single game format)
          if (parsed.region && parsed.lastPlayed && !parsed.hardModeGames) {
            const key = `${parsed.region}-${parsed.lastPlayed}`;
            const newHardModeGames: Record<string, HardModeDailyGame> = {
              [key]: {
                region: parsed.region,
                date: parsed.lastPlayed,
                mode: 'hard',
                guesses: parsed.guesses || [],
                completed: parsed.completed || false,
                won: parsed.won || false,
                maxGuesses: parsed.maxGuesses || 6,
              },
            };

            set({
              hardModeGames: newHardModeGames,
              stats: parsed.stats || createInitialStats(),
            });
          }
          // Handle version 1 (already has hardModeGames)
          else if (parsed.hardModeGames) {
            set({
              hardModeGames: parsed.hardModeGames,
              stats: parsed.stats || createInitialStats(),
            });
          }
        } catch (error) {
          console.error('Failed to migrate old hard mode state:', error);
        }
      },
    }),
    {
      name: 'audio-birdle-hard-mode',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: migrateHardModeState,
      onRehydrateStorage: () => (state) => {
        console.log('Hard mode store rehydrated', state);
      },
    }
  )
);
