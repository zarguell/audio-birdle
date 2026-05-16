import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getStorage, removeStorage } from '../utils/StorageUtils';

export interface TaxonomicScore {
  order: boolean;
  family: boolean;
  genus: boolean;
  species: boolean;
}

export interface Guess {
  birdId: string;
  correct: boolean;
  timestamp: number;
  textInput?: string;
  taxonomicScore?: TaxonomicScore;
}

export interface DailyGame {
  region: string;
  date: string;
  mode: 'normal' | 'hard';
  guesses: Guess[];
  completed: boolean;
  won: boolean;
  maxGuesses: number;
  startTime?: string;
  endTime?: string;
}

export interface RegionStats {
  gamesPlayed: number;
  gamesWon: number;
  totalGuesses: number;
  averageGuesses: number;
}

export interface GameStats {
  totalGamesPlayed: number;
  totalGamesWon: number;
  currentStreak: number;
  maxStreak: number;
  regionStats: Record<string, RegionStats>;
}

export interface GameState {
  dailyGames: Record<string, DailyGame>;
  stats: GameStats;
}

export interface GameActions {
  setDailyGame: (key: string, game: DailyGame) => void;
  getDailyGame: (key: string) => DailyGame | undefined;
  processGuess: (key: string, guess: Guess) => void;
  updateStats: (region: string, won: boolean, guesses: number) => void;
  reset: () => void;
  migrateFromOldStores: () => void;
}

const createInitialStats = (): GameStats => ({
  totalGamesPlayed: 0,
  totalGamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  regionStats: {},
});

function buildStats(
  state: { stats: GameStats },
  region: string,
  won: boolean,
  guesses: number,
): GameStats {
  const newStats = {
    ...state.stats,
    regionStats: { ...state.stats.regionStats },
  };

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

  const rs = { ...newStats.regionStats[region] };
  rs.totalGuesses += guesses;
  rs.gamesPlayed++;
  rs.averageGuesses = rs.totalGuesses / rs.gamesPlayed;

  if (won) {
    rs.gamesWon++;
  }

  newStats.regionStats[region] = rs;

  return newStats;
}

function combineStats(a: GameStats, b: GameStats): GameStats {
  const combined: GameStats = {
    totalGamesPlayed: a.totalGamesPlayed + b.totalGamesPlayed,
    totalGamesWon: a.totalGamesWon + b.totalGamesWon,
    currentStreak: 0,
    maxStreak: Math.max(a.maxStreak, b.maxStreak),
    regionStats: {},
  };

  const allRegions = new Set([
    ...Object.keys(a.regionStats),
    ...Object.keys(b.regionStats),
  ]);
  for (const region of allRegions) {
    const ra = a.regionStats[region] || {
      gamesPlayed: 0,
      gamesWon: 0,
      totalGuesses: 0,
      averageGuesses: 0,
    };
    const rb = b.regionStats[region] || {
      gamesPlayed: 0,
      gamesWon: 0,
      totalGuesses: 0,
      averageGuesses: 0,
    };
    const totalGames = ra.gamesPlayed + rb.gamesPlayed;
    const totalGuesses = ra.totalGuesses + rb.totalGuesses;
    combined.regionStats[region] = {
      gamesPlayed: totalGames,
      gamesWon: ra.gamesWon + rb.gamesWon,
      totalGuesses,
      averageGuesses: totalGames > 0 ? totalGuesses / totalGames : 0,
    };
  }

  return combined;
}

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      dailyGames: {},
      stats: createInitialStats(),

      setDailyGame: (key, game) =>
        set((state) => ({
          dailyGames: { ...state.dailyGames, [key]: game },
        })),

      getDailyGame: (key) => get().dailyGames[key],

      processGuess: (key, guess) => {
        set((state) => {
          const game = state.dailyGames[key];
          if (!game || game.completed) return state;

          const updatedGame: DailyGame = {
            ...game,
            guesses: [...game.guesses, guess],
            startTime: game.startTime || new Date().toISOString(),
          };

          if (
            guess.correct ||
            updatedGame.guesses.length >= updatedGame.maxGuesses
          ) {
            updatedGame.completed = true;
            updatedGame.won = guess.correct;
            updatedGame.endTime = new Date().toISOString();
            return {
              dailyGames: { ...state.dailyGames, [key]: updatedGame },
              stats: buildStats(
                state,
                game.region,
                updatedGame.won,
                updatedGame.guesses.length,
              ),
            };
          }

          return {
            dailyGames: { ...state.dailyGames, [key]: updatedGame },
          };
        });
      },

      updateStats: (region, won, guesses) => {
        set((state) => ({ stats: buildStats(state, region, won, guesses) }));
      },

      reset: () =>
        set({ dailyGames: {}, stats: createInitialStats() }),

      migrateFromOldStores: () => {
        const oldNormalKey = 'audio-birdle-normal-game';
        const oldHardKey = 'audio-birdle-hard-mode';

        const normalData = getStorage(oldNormalKey, null);
        const hardData = getStorage(oldHardKey, null);

        if (!normalData && !hardData) return;

        let mergedDailyGames: Record<string, DailyGame> = {};
        let mergedStats = createInitialStats();

        try {
          if (normalData) {
            const normalState = normalData.state || normalData;
            if (normalState.dailyGames) {
              for (const [key, game] of Object.entries(
                normalState.dailyGames,
              )) {
                mergedDailyGames[`${key}-normal`] = {
                  ...(game as Record<string, unknown>),
                  mode: 'normal',
                } as DailyGame;
              }
            }
            if (normalState.stats) {
              mergedStats = combineStats(
                mergedStats,
                normalState.stats as GameStats,
              );
            }
          }

          if (hardData) {
            const hardState = hardData.state || hardData;
            const gamesKey: Record<string, unknown> =
              hardState.hardModeGames || hardState.dailyGames || {};
            for (const [key, game] of Object.entries(gamesKey)) {
              mergedDailyGames[`${key}-hard`] = {
                ...(game as Record<string, unknown>),
                mode: 'hard',
              } as DailyGame;
            }
            if (hardState.stats) {
              mergedStats = combineStats(
                mergedStats,
                hardState.stats as GameStats,
              );
            }
          }

          set({ dailyGames: mergedDailyGames, stats: mergedStats });

          removeStorage(oldNormalKey);
          removeStorage(oldHardKey);
        } catch (e) {
          console.error('Failed to migrate old stores:', e);
        }
      },
    }),
    {
      name: 'audio-birdle-game',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        console.log('Game store rehydrated');
        if (state && Object.keys(state.dailyGames).length === 0) {
          setTimeout(() => {
            useGameStore.getState().migrateFromOldStores();
          }, 0);
        }
      },
    },
  ),
);
