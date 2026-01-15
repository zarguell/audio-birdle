import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useNormalGameStore } from '@/stores/normalGameStore';

describe('useNormalGameStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store state
    useNormalGameStore.getState().reset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useNormalGameStore.getState();
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

  describe('setDailyGame', () => {
    it('should add a new daily game', () => {
      const { setDailyGame, getDailyGame } = useNormalGameStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);

      const retrieved = getDailyGame(gameKey);
      expect(retrieved).toEqual(gameData);
    });

    it('should update an existing daily game', () => {
      const { setDailyGame, getDailyGame } = useNormalGameStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);
      setDailyGame(gameKey, { ...gameData, completed: true, won: true });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it.skip('should persist to localStorage', () => {
      const { setDailyGame } = useNormalGameStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);

      const stored = localStorage.getItem('audio-birdle-normal-game');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.dailyGames[gameKey]).toEqual(gameData);
    });
  });

  describe('processGuess', () => {
    it('should add a guess to the game', () => {
      const { setDailyGame, processGuess, getDailyGame } = useNormalGameStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);
      processGuess(gameKey, {
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].birdId).toBe('amerob');
      expect(retrieved?.guesses[0].correct).toBe(true);
    });

    it('should mark game as completed and won when correct guess', () => {
      const { setDailyGame, processGuess, getDailyGame } = useNormalGameStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);
      processGuess(gameKey, {
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it('should mark game as completed but not won when max guesses reached', () => {
      const { setDailyGame, processGuess, getDailyGame } = useNormalGameStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);

      // Add 4 incorrect guesses
      for (let i = 0; i < 4; i++) {
        processGuess(gameKey, {
          birdId: `wrong${i}`,
          correct: false,
          timestamp: Date.now(),
        });
      }

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(false);
    });
  });

  describe('updateStats', () => {
    it('should update total games played', () => {
      const { updateStats } = useNormalGameStore.getState();
      updateStats('us', true, 2);

      const state = useNormalGameStore.getState();
      expect(state.stats.totalGamesPlayed).toBe(1);
      expect(state.stats.totalGamesWon).toBe(1);
    });

    it('should update streak correctly', () => {
      const { updateStats } = useNormalGameStore.getState();

      // Win 3 games in a row
      updateStats('us', true, 2);
      updateStats('us', true, 3);
      updateStats('us', true, 1);

      const state = useNormalGameStore.getState();
      expect(state.stats.currentStreak).toBe(3);
      expect(state.stats.maxStreak).toBe(3);
    });

    it('should reset streak on loss', () => {
      const { updateStats } = useNormalGameStore.getState();

      // Win 2 games
      updateStats('us', true, 2);
      updateStats('us', true, 3);
      // Lose 1 game
      updateStats('us', false, 4);

      const state = useNormalGameStore.getState();
      expect(state.stats.currentStreak).toBe(0);
      expect(state.stats.maxStreak).toBe(2);
    });

    it('should track region stats', () => {
      const { updateStats } = useNormalGameStore.getState();
      updateStats('us', true, 2);
      updateStats('us', true, 3);
      updateStats('eu', true, 1);

      const state = useNormalGameStore.getState();
      expect(state.stats.regionStats['us'].gamesPlayed).toBe(2);
      expect(state.stats.regionStats['us'].gamesWon).toBe(2);
      expect(state.stats.regionStats['us'].averageGuesses).toBe(2.5);
      expect(state.stats.regionStats['eu'].gamesPlayed).toBe(1);
    });
  });

  describe('Migration', () => {
    it.skip('should migrate from version 0 to version 2', () => {
      const oldState = {
        region: 'us',
        lastPlayed: '2025-01-15',
        guesses: [{ birdId: 'amerob', correct: true, timestamp: Date.now() }],
        completed: true,
        won: true,
        maxGuesses: 4,
        stats: {
          totalGamesPlayed: 1,
          totalGamesWon: 1,
          currentStreak: 1,
          maxStreak: 1,
          regionStats: {},
        },
      };

      localStorage.setItem('audio-birdle-game-state', JSON.stringify(oldState));

      // Create a new store instance to trigger migration
      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames['us-2025-01-15']).toBeDefined();
      expect(state.dailyGames['us-2025-01-15'].won).toBe(true);
    });

    it.skip('should migrate from version 1 to version 2', () => {
      const oldState = {
        dailyGames: {
          'us-2025-01-15': {
            region: 'us',
            date: '2025-01-15',
            guesses: [],
            completed: false,
            won: false,
            maxGuesses: 4,
          },
        },
        stats: {
          totalGamesPlayed: 1,
          totalGamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          regionStats: {},
        },
      };

      localStorage.setItem('audio-birdle-game-state', JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames['us-2025-01-15']).toBeDefined();
      expect(state.version).toBe(2);
    });

    it('should handle missing old state gracefully', () => {
      localStorage.clear();

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames).toEqual({});
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const { setDailyGame, reset } = useNormalGameStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);
      reset();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames).toEqual({});
      expect(state.stats.totalGamesPlayed).toBe(0);
    });
  });
});
