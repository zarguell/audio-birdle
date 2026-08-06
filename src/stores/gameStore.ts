import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getStorage, removeStorage } from "../utils/StorageUtils";

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
  mode: "normal" | "hard";
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

/**
 * Legacy (pre-consolidation) localStorage keys that must still be imported:
 * - 'audio-birdle-game-state': original pre-Zustand single store
 * - 'audio-birdle-normal-game': former normalGameStore persist key
 * - 'audio-birdle-hard-mode': former hardModeStore persist key
 */
const LEGACY_STORAGE_KEY = "audio-birdle-game-state";
const OLD_NORMAL_STORAGE_KEY = "audio-birdle-normal-game";
const OLD_HARD_STORAGE_KEY = "audio-birdle-hard-mode";

interface LegacyImportTarget {
  dailyGames: Record<string, DailyGame>;
  stats: GameStats;
}

function normalizeGameStats(raw: unknown): GameStats {
  const s = (raw || {}) as Partial<GameStats>;
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const regionStats: Record<string, RegionStats> = {};
  for (const [region, rs] of Object.entries(s.regionStats || {})) {
    if (
      region === "__proto__" ||
      region === "constructor" ||
      region === "prototype"
    ) {
      continue;
    }
    regionStats[region] = {
      gamesPlayed: num(rs?.gamesPlayed),
      gamesWon: num(rs?.gamesWon),
      totalGuesses: num(rs?.totalGuesses),
      averageGuesses: num(rs?.averageGuesses),
    };
  }
  return {
    totalGamesPlayed: num(s.totalGamesPlayed),
    totalGamesWon: num(s.totalGamesWon),
    currentStreak: num(s.currentStreak),
    maxStreak: num(s.maxStreak),
    regionStats,
  };
}

/**
 * Import one legacy persisted store into `target` (in place).
 *
 * Supported shapes:
 * - v0 single game: { region, lastPlayed, guesses, completed, won,
 *   maxGuesses, mode?, startTime?, endTime? }
 *   -> dailyGames[`${region}-${lastPlayed}-${mode}`]
 * - v1 multi-game: { dailyGames | hardModeGames, stats }
 *   -> each entry keyed `${originalKey}-${mode}` (unless the key already
 *   carries a -normal/-hard suffix)
 *
 * `defaultMode` is implied by which store the key belongs to
 * ('audio-birdle-game-state' -> normal, 'audio-birdle-hard-mode' -> hard).
 * `parsed.mode` (if present) wins over the default.
 */
function importLegacyStore(
  target: LegacyImportTarget,
  storageKey: string,
  defaultMode: "normal" | "hard",
  mergeStats = true,
): void {
  const raw = getStorage(storageKey, null);
  if (!raw) return;

  // Handle both raw legacy objects and Zustand-persist wrappers ({ state, version })
  const parsed =
    (raw as { state?: Record<string, unknown> }).state ||
    (raw as Record<string, unknown>);
  if (!parsed || typeof parsed !== "object") return;

  if (
    parsed.region &&
    parsed.lastPlayed &&
    !parsed.dailyGames &&
    !parsed.hardModeGames
  ) {
    // v0 single-game shape
    const mode =
      parsed.mode === "hard" || parsed.mode === "normal"
        ? parsed.mode
        : defaultMode;
    const key = `${parsed.region}-${parsed.lastPlayed}-${mode}`;
    const game: DailyGame = {
      region: parsed.region as string,
      date: parsed.lastPlayed as string,
      mode,
      guesses: (parsed.guesses as Guess[]) || [],
      completed: Boolean(parsed.completed),
      won: Boolean(parsed.won),
      maxGuesses: (parsed.maxGuesses as number) || (mode === "hard" ? 6 : 4),
    };
    if (parsed.startTime) game.startTime = parsed.startTime as string;
    if (parsed.endTime) game.endTime = parsed.endTime as string;
    target.dailyGames[key] = game;
  } else {
    // v1 multi-game shape
    const gamesMap = (parsed.hardModeGames ||
      parsed.dailyGames ||
      {}) as Record<string, DailyGame>;
    for (const [key, game] of Object.entries(gamesMap)) {
      const hasModeSuffix = key.endsWith("-normal") || key.endsWith("-hard");
      const newKey = hasModeSuffix ? key : `${key}-${defaultMode}`;
      target.dailyGames[newKey] = {
        ...(game as Record<string, unknown>),
        mode: defaultMode,
      } as DailyGame;
    }
  }

  if (mergeStats && parsed.stats) {
    target.stats = combineStats(target.stats, normalizeGameStats(parsed.stats));
  }
}

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
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const combined: GameStats = {
    totalGamesPlayed: num(a.totalGamesPlayed) + num(b.totalGamesPlayed),
    totalGamesWon: num(a.totalGamesWon) + num(b.totalGamesWon),
    currentStreak: Math.max(num(a.currentStreak), num(b.currentStreak)),
    maxStreak: Math.max(num(a.maxStreak), num(b.maxStreak)),
    regionStats: {},
  };

  const allRegions = new Set([
    ...Object.keys(a.regionStats),
    ...Object.keys(b.regionStats),
  ]);
  for (const region of allRegions) {
    // Never treat prototype-chain keys as regions: a hostile legacy payload
    // could otherwise pollute regionStats via '__proto__'.
    if (
      region === "__proto__" ||
      region === "constructor" ||
      region === "prototype"
    ) {
      continue;
    }
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
    const totalGames = num(ra.gamesPlayed) + num(rb.gamesPlayed);
    const totalGuesses = num(ra.totalGuesses) + num(rb.totalGuesses);
    combined.regionStats[region] = {
      gamesPlayed: totalGames,
      gamesWon: num(ra.gamesWon) + num(rb.gamesWon),
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

      /**
       * @deprecated Stats are updated automatically by processGuess when a
       * game completes. Kept for backward compatibility with existing tests.
       */
      updateStats: (region, won, guesses) => {
        set((state) => ({ stats: buildStats(state, region, won, guesses) }));
      },

      reset: () => set({ dailyGames: {}, stats: createInitialStats() }),

      migrateFromOldStores: () => {
        try {
          set((state) => {
            const merged: LegacyImportTarget = {
              dailyGames: { ...state.dailyGames },
              stats: normalizeGameStats(state.stats),
            };
            // If the former zustand stores exist, their stats already contain
            // the legacy key's data (the old migration merged it in and kept
            // the key as a backup) — merging it again would double-count.
            const hasOldZustandStores = Boolean(
              getStorage(OLD_NORMAL_STORAGE_KEY, null) ||
              getStorage(OLD_HARD_STORAGE_KEY, null),
            );
            importLegacyStore(
              merged,
              LEGACY_STORAGE_KEY,
              "normal",
              !hasOldZustandStores,
            );
            importLegacyStore(merged, OLD_NORMAL_STORAGE_KEY, "normal");
            importLegacyStore(merged, OLD_HARD_STORAGE_KEY, "hard");
            return { dailyGames: merged.dailyGames, stats: merged.stats };
          });

          removeStorage(LEGACY_STORAGE_KEY);
          removeStorage(OLD_NORMAL_STORAGE_KEY);
          removeStorage(OLD_HARD_STORAGE_KEY);
        } catch (e) {
          console.error("Failed to migrate old stores:", e);
        }
      },
    }),
    {
      name: "audio-birdle-game",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState, version) => {
        if (version >= 2) return persistedState;
        // v1 -> v2: also import every legacy store (pre-Zustand single store
        // plus the former normal/hard stores) so old players' games and stats
        // flow through versioned migration.
        const state = (persistedState || {}) as {
          dailyGames?: Record<string, DailyGame>;
          stats?: GameStats;
        };
        const merged: LegacyImportTarget = {
          dailyGames: state.dailyGames ? { ...state.dailyGames } : {},
          stats: normalizeGameStats(state.stats),
        };
        // Same double-count guard as migrateFromOldStores: the old zustand
        // stores already absorbed the legacy key's stats when they migrated.
        const hasOldZustandStores = Boolean(
          getStorage(OLD_NORMAL_STORAGE_KEY, null) ||
          getStorage(OLD_HARD_STORAGE_KEY, null),
        );
        importLegacyStore(
          merged,
          LEGACY_STORAGE_KEY,
          "normal",
          !hasOldZustandStores,
        );
        importLegacyStore(merged, OLD_NORMAL_STORAGE_KEY, "normal");
        importLegacyStore(merged, OLD_HARD_STORAGE_KEY, "hard");
        removeStorage(LEGACY_STORAGE_KEY);
        removeStorage(OLD_NORMAL_STORAGE_KEY);
        removeStorage(OLD_HARD_STORAGE_KEY);
        return merged;
      },
      onRehydrateStorage: () => (state) => {
        console.log("Game store rehydrated");
        if (state && Object.keys(state.dailyGames).length === 0) {
          setTimeout(() => {
            useGameStore.getState().migrateFromOldStores();
          }, 0);
        }
      },
    },
  ),
);
