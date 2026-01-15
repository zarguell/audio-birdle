import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useHardModeStore } from '@/stores/hardModeStore';

describe('useHardModeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useHardModeStore.getState().reset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useHardModeStore.getState();
      expect(state.hardModeGames).toEqual({});
      expect(state.stats).toEqual({
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        regionStats: {},
      });
    });
  });

  describe('setHardModeGame', () => {
    it('should add a new hard mode game', () => {
      const { setHardModeGame, getHardModeGame } = useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);

      const retrieved = getHardModeGame(gameKey);
      expect(retrieved).toEqual(gameData);
    });

    it('should update an existing hard mode game', () => {
      const { setHardModeGame, getHardModeGame } = useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);
      setHardModeGame(gameKey, { ...gameData, completed: true, won: true });

      const retrieved = getHardModeGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it.skip('should persist to localStorage', () => {
      const { setHardModeGame } = useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);

      const stored = localStorage.getItem('audio-birdle-hard-mode');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.hardModeGames[gameKey]).toEqual(gameData);
    });
  });

  describe('processHardModeGuess', () => {
    it('should add a guess with taxonomic score', () => {
      const { setHardModeGame, processHardModeGuess, getHardModeGame } =
        useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);
      processHardModeGuess(gameKey, {
        birdId: 'amerob',
        textInput: 'american robin',
        correct: true,
        timestamp: Date.now(),
        taxonomicScore: {
          order: true,
          family: true,
          genus: true,
          species: true,
        },
      });

      const retrieved = getHardModeGame(gameKey);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].birdId).toBe('amerob');
      expect(retrieved?.guesses[0].textInput).toBe('american robin');
      expect(retrieved?.guesses[0].taxonomicScore.species).toBe(true);
    });

    it('should mark game as completed and won when correct guess', () => {
      const { setHardModeGame, processHardModeGuess, getHardModeGame } =
        useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);
      processHardModeGuess(gameKey, {
        birdId: 'amerob',
        textInput: 'american robin',
        correct: true,
        timestamp: Date.now(),
        taxonomicScore: {
          order: true,
          family: true,
          genus: true,
          species: true,
        },
      });

      const retrieved = getHardModeGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it('should mark game as completed but not won when max guesses reached', () => {
      const { setHardModeGame, processHardModeGuess, getHardModeGame } =
        useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);

      // Add 6 incorrect guesses
      for (let i = 0; i < 6; i++) {
        processHardModeGuess(gameKey, {
          birdId: `wrong${i}`,
          textInput: `wrong species ${i}`,
          correct: false,
          timestamp: Date.now(),
          taxonomicScore: {
            order: false,
            family: false,
            genus: false,
            species: false,
          },
        });
      }

      const retrieved = getHardModeGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(false);
    });

    it('should handle partial taxonomic matches', () => {
      const { setHardModeGame, processHardModeGuess, getHardModeGame } =
        useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);
      processHardModeGuess(gameKey, {
        birdId: 'rowar1',
        textInput: 'warbler',
        correct: false,
        timestamp: Date.now(),
        taxonomicScore: {
          order: true,
          family: true,
          genus: false,
          species: false,
        },
      });

      const retrieved = getHardModeGame(gameKey);
      expect(retrieved?.guesses[0].taxonomicScore.order).toBe(true);
      expect(retrieved?.guesses[0].taxonomicScore.family).toBe(true);
      expect(retrieved?.guesses[0].taxonomicScore.genus).toBe(false);
    });
  });

  describe('updateHardModeStats', () => {
    it('should update total games played', () => {
      const { updateHardModeStats } = useHardModeStore.getState();
      updateHardModeStats('us', true, 2);

      const state = useHardModeStore.getState();
      expect(state.stats.totalGamesPlayed).toBe(1);
      expect(state.stats.totalGamesWon).toBe(1);
    });

    it('should update streak correctly', () => {
      const { updateHardModeStats } = useHardModeStore.getState();

      // Win 3 games in a row
      updateHardModeStats('us', true, 2);
      updateHardModeStats('us', true, 3);
      updateHardModeStats('us', true, 1);

      const state = useHardModeStore.getState();
      expect(state.stats.currentStreak).toBe(3);
      expect(state.stats.maxStreak).toBe(3);
    });

    it('should reset streak on loss', () => {
      const { updateHardModeStats } = useHardModeStore.getState();

      // Win 2 games
      updateHardModeStats('us', true, 2);
      updateHardModeStats('us', true, 3);
      // Lose 1 game
      updateHardModeStats('us', false, 6);

      const state = useHardModeStore.getState();
      expect(state.stats.currentStreak).toBe(0);
      expect(state.stats.maxStreak).toBe(2);
    });

    it('should track region stats', () => {
      const { updateHardModeStats } = useHardModeStore.getState();
      updateHardModeStats('us', true, 2);
      updateHardModeStats('us', true, 3);
      updateHardModeStats('eu', true, 1);

      const state = useHardModeStore.getState();
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
        mode: 'hard',
        guesses: [
          {
            birdId: 'amerob',
            textInput: 'american robin',
            correct: true,
            timestamp: Date.now(),
            taxonomicScore: {
              order: true,
              family: true,
              genus: true,
              species: true,
            },
          },
        ],
        completed: true,
        won: true,
        maxGuesses: 6,
        stats: {
          totalGamesPlayed: 1,
          totalGamesWon: 1,
          currentStreak: 1,
          maxStreak: 1,
          regionStats: {},
        },
      };

      localStorage.setItem('audio-birdle-hard-mode', JSON.stringify(oldState));

      useHardModeStore.getState().migrateFromOldFormat();

      const state = useHardModeStore.getState();
      expect(state.hardModeGames['us-2025-01-15']).toBeDefined();
      expect(state.hardModeGames['us-2025-01-15'].won).toBe(true);
    });

    it.skip('should migrate from version 1 to version 2', () => {
      const oldState = {
        hardModeGames: {
          'us-2025-01-15': {
            region: 'us',
            date: '2025-01-15',
            mode: 'hard',
            guesses: [],
            completed: false,
            won: false,
            maxGuesses: 6,
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

      localStorage.setItem('audio-birdle-hard-mode', JSON.stringify(oldState));

      useHardModeStore.getState().migrateFromOldFormat();

      const state = useHardModeStore.getState();
      expect(state.hardModeGames['us-2025-01-15']).toBeDefined();
      expect(state.version).toBe(2);
    });

    it('should handle missing old state gracefully', () => {
      localStorage.clear();

      useHardModeStore.getState().migrateFromOldFormat();

      const state = useHardModeStore.getState();
      expect(state.hardModeGames).toEqual({});
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const { setHardModeGame, reset } = useHardModeStore.getState();
      const gameKey = 'us-2025-01-15';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setHardModeGame(gameKey, gameData);
      reset();

      const state = useHardModeStore.getState();
      expect(state.hardModeGames).toEqual({});
      expect(state.stats.totalGamesPlayed).toBe(0);
    });
  });
});
