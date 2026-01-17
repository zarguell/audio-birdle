import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useNormalGameStore } from "@/stores/normalGameStore";

describe("useNormalGameStore", () => {
  describe("Initial State", () => {
    beforeEach(() => {
      // Clear localStorage and reset store for non-migration tests
      localStorage.clear();
      useNormalGameStore.getState().reset();
    });

    it("should have correct initial state", () => {
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

  describe("setDailyGame", () => {
    beforeEach(() => {
      localStorage.clear();
      useNormalGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });
    it("should add a new daily game", () => {
      const { setDailyGame, getDailyGame } = useNormalGameStore.getState();
      const gameKey = "us-2025-01-15";
      const gameData = {
        region: "us",
        date: "2025-01-15",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);

      const retrieved = getDailyGame(gameKey);
      expect(retrieved).toEqual(gameData);
    });

    it("should update an existing daily game", () => {
      const { setDailyGame, getDailyGame } = useNormalGameStore.getState();
      const gameKey = "us-2025-01-15";
      const gameData = {
        region: "us",
        date: "2025-01-15",
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

    it.skip("should persist to localStorage", () => {
      const { setDailyGame } = useNormalGameStore.getState();
      const gameKey = "us-2025-01-15";
      const gameData = {
        region: "us",
        date: "2025-01-15",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);

      const stored = localStorage.getItem("audio-birdle-normal-game");
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.dailyGames[gameKey]).toEqual(gameData);
    });
  });

  describe("processGuess", () => {
    beforeEach(() => {
      localStorage.clear();
      useNormalGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });
    it("should add a guess to the game", () => {
      const { setDailyGame, processGuess, getDailyGame } =
        useNormalGameStore.getState();
      const gameKey = "us-2025-01-15";
      const gameData = {
        region: "us",
        date: "2025-01-15",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);
      processGuess(gameKey, {
        birdId: "amerob",
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].birdId).toBe("amerob");
      expect(retrieved?.guesses[0].correct).toBe(true);
    });

    it("should mark game as completed and won when correct guess", () => {
      const { setDailyGame, processGuess, getDailyGame } =
        useNormalGameStore.getState();
      const gameKey = "us-2025-01-15";
      const gameData = {
        region: "us",
        date: "2025-01-15",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);
      processGuess(gameKey, {
        birdId: "amerob",
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it("should mark game as completed but not won when max guesses reached", () => {
      const { setDailyGame, processGuess, getDailyGame } =
        useNormalGameStore.getState();
      const gameKey = "us-2025-01-15";
      const gameData = {
        region: "us",
        date: "2025-01-15",
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

  describe("updateStats", () => {
    beforeEach(() => {
      localStorage.clear();
      useNormalGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });
    it("should update total games played", () => {
      const { updateStats } = useNormalGameStore.getState();
      updateStats("us", true, 2);

      const state = useNormalGameStore.getState();
      expect(state.stats.totalGamesPlayed).toBe(1);
      expect(state.stats.totalGamesWon).toBe(1);
    });

    it("should update streak correctly", () => {
      const { updateStats } = useNormalGameStore.getState();

      // Win 3 games in a row
      updateStats("us", true, 2);
      updateStats("us", true, 3);
      updateStats("us", true, 1);

      const state = useNormalGameStore.getState();
      expect(state.stats.currentStreak).toBe(3);
      expect(state.stats.maxStreak).toBe(3);
    });

    it("should reset streak on loss", () => {
      const { updateStats } = useNormalGameStore.getState();

      // Win 2 games
      updateStats("us", true, 2);
      updateStats("us", true, 3);
      // Lose 1 game
      updateStats("us", false, 4);

      const state = useNormalGameStore.getState();
      expect(state.stats.currentStreak).toBe(0);
      expect(state.stats.maxStreak).toBe(2);
    });

    it("should track region stats", () => {
      const { updateStats } = useNormalGameStore.getState();
      updateStats("us", true, 2);
      updateStats("us", true, 3);
      updateStats("eu", true, 1);

      const state = useNormalGameStore.getState();
      expect(state.stats.regionStats["us"].gamesPlayed).toBe(2);
      expect(state.stats.regionStats["us"].gamesWon).toBe(2);
      expect(state.stats.regionStats["us"].averageGuesses).toBe(2.5);
      expect(state.stats.regionStats["eu"].gamesPlayed).toBe(1);
    });
  });

  describe("Migration", () => {
    // Note: Don't reset in beforeEach for migration tests - we need the state to persist
    afterEach(() => {
      localStorage.clear();
    });
    it("should migrate from version 0 to version 2", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-15",
        guesses: [{ birdId: "amerob", correct: true, timestamp: Date.now() }],
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

      localStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      // Trigger migration
      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames["us-2025-01-15"]).toBeDefined();
      expect(state.dailyGames["us-2025-01-15"].won).toBe(true);
      expect(state.dailyGames["us-2025-01-15"].guesses).toHaveLength(1);
      expect(state.stats.totalGamesPlayed).toBe(1);
      expect(state.stats.totalGamesWon).toBe(1);
    });

    it("should migrate from version 1 to version 2", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      const oldState = {
        dailyGames: {
          "us-2025-01-15": {
            region: "us",
            date: "2025-01-15",
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

      localStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames["us-2025-01-15"]).toBeDefined();
      expect(state.stats.totalGamesPlayed).toBe(1);
    });

    it("should handle missing old state gracefully", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      localStorage.clear();

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames).toEqual({});
    });

    it("should migrate multiple games from version 0", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-16",
        guesses: [{ birdId: "mallar3", correct: false, timestamp: Date.now() }],
        completed: false,
        won: false,
        maxGuesses: 4,
        stats: {
          totalGamesPlayed: 5,
          totalGamesWon: 3,
          currentStreak: 2,
          maxStreak: 3,
          regionStats: {
            us: {
              gamesPlayed: 5,
              gamesWon: 3,
              totalGuesses: 12,
              averageGuesses: 2.4,
            },
          },
        },
      };

      localStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames["us-2025-01-16"]).toBeDefined();
      expect(state.stats.totalGamesPlayed).toBe(5);
      expect(state.stats.totalGamesWon).toBe(3);
      expect(state.stats.currentStreak).toBe(2);
      expect(state.stats.maxStreak).toBe(3);
      expect(state.stats.regionStats["us"]).toBeDefined();
    });

    it("should migrate with multiple regions from version 1", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      const oldState = {
        dailyGames: {
          "us-2025-01-15": {
            region: "us",
            date: "2025-01-15",
            guesses: [
              { birdId: "amerob", correct: true, timestamp: Date.now() },
            ],
            completed: true,
            won: true,
            maxGuesses: 4,
          },
          "eu-2025-01-15": {
            region: "eu",
            date: "2025-01-15",
            guesses: [],
            completed: false,
            won: false,
            maxGuesses: 4,
          },
        },
        stats: {
          totalGamesPlayed: 2,
          totalGamesWon: 1,
          currentStreak: 1,
          maxStreak: 1,
          regionStats: {
            us: {
              gamesPlayed: 1,
              gamesWon: 1,
              totalGuesses: 2,
              averageGuesses: 2,
            },
            eu: {
              gamesPlayed: 1,
              gamesWon: 0,
              totalGuesses: 0,
              averageGuesses: 0,
            },
          },
        },
      };

      localStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames["us-2025-01-15"]).toBeDefined();
      expect(state.dailyGames["eu-2025-01-15"]).toBeDefined();
      expect(state.stats.regionStats["us"]).toBeDefined();
      expect(state.stats.regionStats["eu"]).toBeDefined();
    });

    it("should handle corrupt data gracefully", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      localStorage.setItem("audio-birdle-game-state", "invalid json");

      // Should not throw
      expect(() => {
        useNormalGameStore.getState().migrateFromOldFormat();
      }).not.toThrow();

      // State should remain unchanged
      const state = useNormalGameStore.getState();
      expect(state.dailyGames).toEqual({});
    });

    it("should handle missing fields in old state with defaults", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-15",
        // Missing guesses, completed, won, maxGuesses, stats
      };

      localStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames["us-2025-01-15"]).toBeDefined();
      expect(state.dailyGames["us-2025-01-15"].guesses).toEqual([]);
      expect(state.dailyGames["us-2025-01-15"].completed).toBe(false);
      expect(state.dailyGames["us-2025-01-15"].won).toBe(false);
      expect(state.dailyGames["us-2025-01-15"].maxGuesses).toBe(4); // default
    });

    it.skip("should be idempotent - can run multiple times safely", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-15",
        guesses: [{ birdId: "amerob", correct: true, timestamp: Date.now() }],
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

      localStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      // Run migration twice
      useNormalGameStore.getState().migrateFromOldFormat();
      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      // Should still have the same data, not duplicated
      expect(Object.keys(state.dailyGames)).toHaveLength(1);
      expect(state.stats.totalGamesPlayed).toBe(1);
    });

    it("should preserve startTime and endTime if present in old state", () => {
      useNormalGameStore.getState().reset(); // Start fresh
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-15",
        guesses: [{ birdId: "amerob", correct: true, timestamp: Date.now() }],
        completed: true,
        won: true,
        maxGuesses: 4,
        startTime: "2025-01-15T10:00:00.000Z",
        endTime: "2025-01-15T10:01:00.000Z",
      };

      localStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const state = useNormalGameStore.getState();
      expect(state.dailyGames["us-2025-01-15"].startTime).toBe(
        "2025-01-15T10:00:00.000Z",
      );
      expect(state.dailyGames["us-2025-01-15"].endTime).toBe(
        "2025-01-15T10:01:00.000Z",
      );
    });
  });

  describe("reset", () => {
    beforeEach(() => {
      localStorage.clear();
      useNormalGameStore.getState().reset();
    });

    afterEach(() => {
      localStorage.clear();
    });
    it("should clear all state", () => {
      const { setDailyGame, reset } = useNormalGameStore.getState();
      const gameKey = "us-2025-01-15";
      const gameData = {
        region: "us",
        date: "2025-01-15",
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
