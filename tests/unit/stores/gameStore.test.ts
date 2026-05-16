import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/stores/gameStore';

const GAME_KEY = ['us', '2025', '01', '15', 'normal'].join('-');
const HARD_KEY = ['us', '2025', '01', '15', 'hard'].join('-');
const GAME_REGION = 'us';
const GAME_DATE = ['2025', '01', '15'].join('-');

describe('useGameStore', () => {
  describe('Initial State', () => {
    beforeEach(() => {
      localStorage.clear();
      useGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should have correct initial state', () => {
      const state = useGameStore.getState();
      expect(state.dailyGames).toEqual({});
      expect(state.stats).toEqual({
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        regionStats: {},
      });
    });
  });

  describe('setDailyGame / getDailyGame', () => {
    beforeEach(() => {
      localStorage.clear();
      useGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should add a new normal mode daily game', () => {
      const { setDailyGame, getDailyGame } = useGameStore.getState();
      const gameData = {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal' as const,
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(GAME_KEY, gameData);
      expect(getDailyGame(GAME_KEY)).toEqual(gameData);
    });

    it('should add a new hard mode daily game', () => {
      const { setDailyGame, getDailyGame } = useGameStore.getState();
      const gameData = {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'hard' as const,
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setDailyGame(HARD_KEY, gameData);
      expect(getDailyGame(HARD_KEY)).toEqual(gameData);
    });

    it('should update an existing daily game', () => {
      const { setDailyGame, getDailyGame } = useGameStore.getState();
      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [{ birdId: 'amerob', correct: true, timestamp: 123 }],
        completed: true,
        won: true,
        maxGuesses: 4,
      });

      const retrieved = getDailyGame(GAME_KEY);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
      expect(retrieved?.guesses).toHaveLength(1);
    });
  });

  describe('processGuess', () => {
    beforeEach(() => {
      localStorage.clear();
      useGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should add a guess to a normal mode game', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      processGuess(GAME_KEY, {
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(GAME_KEY);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].birdId).toBe('amerob');
    });

    it('should add a guess with taxonomic score to a hard mode game', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      setDailyGame(HARD_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      });

      processGuess(HARD_KEY, {
        birdId: 'amerob',
        correct: false,
        timestamp: Date.now(),
        textInput: 'American Robin',
        taxonomicScore: { order: true, family: true, genus: false, species: false },
      });

      const retrieved = getDailyGame(HARD_KEY);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].textInput).toBe('American Robin');
      expect(retrieved?.guesses[0].taxonomicScore).toEqual({
        order: true, family: true, genus: false, species: false,
      });
    });

    it('should mark game as completed and won on correct guess', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      processGuess(GAME_KEY, {
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(GAME_KEY);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it('should mark game as completed but not won on max guesses', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      for (let i = 0; i < 4; i++) {
        processGuess(GAME_KEY, {
          birdId: `wrong${i}`,
          correct: false,
          timestamp: Date.now(),
        });
      }

      const retrieved = getDailyGame(GAME_KEY);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(false);
    });

    it('should not modify a completed game', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [],
        completed: true,
        won: true,
        maxGuesses: 4,
      });

      processGuess(GAME_KEY, {
        birdId: 'extra',
        correct: false,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(GAME_KEY);
      expect(retrieved?.guesses).toHaveLength(0);
    });

    it('should handle nonexistent game key gracefully', () => {
      const { processGuess } = useGameStore.getState();
      expect(() => {
        processGuess('nonexistent-key', {
          birdId: 'amerob',
          correct: false,
          timestamp: Date.now(),
        });
      }).not.toThrow();
    });

    it('should set startTime on first guess', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      processGuess(GAME_KEY, {
        birdId: 'amerob',
        correct: false,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(GAME_KEY);
      expect(retrieved?.startTime).toBeDefined();
    });
  });

  describe('updateStats', () => {
    beforeEach(() => {
      localStorage.clear();
      useGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should update total games played and won', () => {
      useGameStore.getState().updateStats(GAME_REGION, true, 2);
      const state = useGameStore.getState();
      expect(state.stats.totalGamesPlayed).toBe(1);
      expect(state.stats.totalGamesWon).toBe(1);
    });

    it('should accumulate region stats', () => {
      const { updateStats } = useGameStore.getState();
      updateStats(GAME_REGION, true, 2);
      updateStats(GAME_REGION, true, 3);
      updateStats('eu', false, 4);

      const state = useGameStore.getState();
      expect(state.stats.regionStats[GAME_REGION].gamesPlayed).toBe(2);
      expect(state.stats.regionStats[GAME_REGION].gamesWon).toBe(2);
      expect(state.stats.regionStats['eu'].gamesPlayed).toBe(1);
      expect(state.stats.regionStats['eu'].gamesWon).toBe(0);
    });

    it('should update streak correctly', () => {
      const { updateStats } = useGameStore.getState();
      updateStats(GAME_REGION, true, 2);
      updateStats(GAME_REGION, true, 3);
      updateStats(GAME_REGION, true, 1);

      const state = useGameStore.getState();
      expect(state.stats.currentStreak).toBe(3);
      expect(state.stats.maxStreak).toBe(3);
    });

    it('should reset streak on loss', () => {
      const { updateStats } = useGameStore.getState();
      updateStats(GAME_REGION, true, 2);
      updateStats(GAME_REGION, true, 3);
      updateStats(GAME_REGION, false, 4);

      const state = useGameStore.getState();
      expect(state.stats.currentStreak).toBe(0);
      expect(state.stats.maxStreak).toBe(2);
    });

    it('should compute average guesses correctly', () => {
      const { updateStats } = useGameStore.getState();
      updateStats(GAME_REGION, true, 2);
      updateStats(GAME_REGION, true, 4);

      const state = useGameStore.getState();
      expect(state.stats.regionStats[GAME_REGION].averageGuesses).toBe(3);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      localStorage.clear();
      useGameStore.getState().reset();
    });

    it('should clear all state', () => {
      const { setDailyGame, reset } = useGameStore.getState();
      setDailyGame(GAME_KEY, {
        region: GAME_REGION,
        date: GAME_DATE,
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      reset();

      const state = useGameStore.getState();
      expect(state.dailyGames).toEqual({});
      expect(state.stats.totalGamesPlayed).toBe(0);
    });
  });

  describe('Migration from old stores', () => {
    afterEach(() => {
      localStorage.clear();
    });

    it('should not fail when no old stores exist', () => {
      localStorage.clear();
      useGameStore.getState().reset();
      expect(() => {
        useGameStore.getState().migrateFromOldStores();
      }).not.toThrow();
      const state = useGameStore.getState();
      expect(state.dailyGames).toEqual({});
      expect(state.stats.totalGamesPlayed).toBe(0);
    });

    it('should migrate from old normalGameStore localStorage key', () => {
      useGameStore.getState().reset();

      const oldNormalData = {
        state: {
          dailyGames: {
            [GAME_KEY.replace('-normal', '')]: {
              region: GAME_REGION,
              date: GAME_DATE,
              guesses: [{ birdId: 'amerob', correct: true, timestamp: 123 }],
              completed: true,
              won: true,
              maxGuesses: 4,
            },
          },
          stats: {
            totalGamesPlayed: 1,
            totalGamesWon: 1,
            currentStreak: 1,
            maxStreak: 1,
            regionStats: { [GAME_REGION]: { gamesPlayed: 1, gamesWon: 1, totalGuesses: 1, averageGuesses: 1 } },
          },
        },
        version: 2,
      };

      localStorage.setItem('audio-birdle-normal-game', JSON.stringify(oldNormalData));

      useGameStore.getState().migrateFromOldStores();

      const state = useGameStore.getState();
      expect(state.dailyGames[GAME_KEY]).toBeDefined();
      expect(state.dailyGames[GAME_KEY].guesses).toHaveLength(1);
      expect(state.dailyGames[GAME_KEY].mode).toBe('normal');
      expect(state.stats.totalGamesPlayed).toBe(1);
    });

    it('should migrate from old hardModeStore localStorage key', () => {
      useGameStore.getState().reset();

      const oldHardData = {
        state: {
          hardModeGames: {
            [HARD_KEY.replace('-hard', '')]: {
              region: GAME_REGION,
              date: GAME_DATE,
              mode: 'hard',
              guesses: [{ birdId: 'amerob', correct: true, timestamp: 123, textInput: 'American Robin', taxonomicScore: { order: true, family: true, genus: false, species: false } }],
              completed: true,
              won: true,
              maxGuesses: 6,
            },
          },
          stats: {
            totalGamesPlayed: 1,
            totalGamesWon: 1,
            currentStreak: 1,
            maxStreak: 1,
            regionStats: {},
          },
        },
        version: 2,
      };

      localStorage.setItem('audio-birdle-hard-mode', JSON.stringify(oldHardData));

      useGameStore.getState().migrateFromOldStores();

      const state = useGameStore.getState();
      expect(state.dailyGames[HARD_KEY]).toBeDefined();
      expect(state.dailyGames[HARD_KEY].mode).toBe('hard');
      expect(state.stats.totalGamesPlayed).toBe(1);
    });

    it('should merge stats from both old stores', () => {
      useGameStore.getState().reset();

      localStorage.setItem('audio-birdle-normal-game', JSON.stringify({
        state: {
          dailyGames: {},
          stats: { totalGamesPlayed: 5, totalGamesWon: 3, currentStreak: 1, maxStreak: 3, regionStats: { [GAME_REGION]: { gamesPlayed: 5, gamesWon: 3, totalGuesses: 10, averageGuesses: 2 } } },
        },
        version: 2,
      }));

      localStorage.setItem('audio-birdle-hard-mode', JSON.stringify({
        state: {
          hardModeGames: {},
          stats: { totalGamesPlayed: 3, totalGamesWon: 1, currentStreak: 0, maxStreak: 2, regionStats: { [GAME_REGION]: { gamesPlayed: 3, gamesWon: 1, totalGuesses: 12, averageGuesses: 4 } } },
        },
        version: 2,
      }));

      useGameStore.getState().migrateFromOldStores();

      const state = useGameStore.getState();
      expect(state.stats.totalGamesPlayed).toBe(8);
      expect(state.stats.totalGamesWon).toBe(4);
      expect(state.stats.maxStreak).toBe(3);
    });

    it('should be idempotent', () => {
      useGameStore.getState().reset();

      localStorage.setItem('audio-birdle-normal-game', JSON.stringify({
        state: {
          dailyGames: { [GAME_KEY.replace('-normal', '')]: { region: GAME_REGION, date: GAME_DATE, mode: 'normal', guesses: [], completed: false, won: false, maxGuesses: 4 } },
          stats: { totalGamesPlayed: 1, totalGamesWon: 0, currentStreak: 0, maxStreak: 0, regionStats: {} },
        },
        version: 2,
      }));

      useGameStore.getState().migrateFromOldStores();
      const state1 = useGameStore.getState();

      useGameStore.getState().migrateFromOldStores();
      const state2 = useGameStore.getState();

      expect(state2.dailyGames).toEqual(state1.dailyGames);
      expect(state2.stats).toEqual(state1.stats);
    });
  });
});
