import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNormalGameStore } from "@/stores/normalGameStore";
import { useHardModeStore } from "@/stores/hardModeStore";
import { usePracticeStore } from "@/stores/practiceStore";
import { createMockLocalStorage } from "@test/setup";
import {
  createTestGameState as UNUSED_GAME_STATE,
  createTestDailyGame,
  createTestBird,
  createCompletedGame as UNUSED_COMPLETED_GAME,
  createHardModeGame,
  createHardModeGuess,
} from "@test/fixtures/integration-fixtures";

describe("Store Interactions Integration", () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockStorage);

    vi.clearAllMocks();
  });

  describe("Normal Game Store", () => {
    beforeEach(() => {
      useNormalGameStore.getState().reset();
      useHardModeStore.getState().reset();
      usePracticeStore.getState().reset();
    });

    it("should create a new daily game entry", () => {
      const key = "us-2025-01-15";
      const game = createTestDailyGame();

      useNormalGameStore.getState().setDailyGame(key, game);

      const retrieved = useNormalGameStore.getState().getDailyGame(key);
      expect(retrieved).toEqual(game);
      expect(retrieved?.completed).toBe(false);
      expect(retrieved?.won).toBe(false);
    });

    it("should add a guess to a game", () => {
      const key = "us-2025-01-15";
      const game = createTestDailyGame();
      useNormalGameStore.getState().setDailyGame(key, game);

      const guess = {
        birdId: "testbird",
        correct: false,
        timestamp: Date.now(),
      };

      useNormalGameStore.getState().processGuess(key, guess);

      const retrieved = useNormalGameStore.getState().getDailyGame(key);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0]).toEqual(guess);
    });

    it("should complete a game on correct guess", () => {
      const key = "us-2025-01-15";
      const game = createTestDailyGame({ maxGuesses: 4 });
      useNormalGameStore.getState().setDailyGame(key, game);

      const guess = {
        birdId: "correct",
        correct: true,
        timestamp: Date.now(),
      };

      useNormalGameStore.getState().processGuess(key, guess);

      const retrieved = useNormalGameStore.getState().getDailyGame(key);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
      expect(retrieved?.guesses).toHaveLength(1);
    });

    it("should complete a game on max guesses without winning", () => {
      const key = "us-2025-01-15";
      const game = createTestDailyGame({ maxGuesses: 4 });
      useNormalGameStore.getState().setDailyGame(key, game);

      for (let i = 0; i < 4; i++) {
        const guess = {
          birdId: `wrong-${i}`,
          correct: false,
          timestamp: Date.now() + i,
        };
        useNormalGameStore.getState().processGuess(key, guess);
      }

      const retrieved = useNormalGameStore.getState().getDailyGame(key);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(false);
      expect(retrieved?.guesses).toHaveLength(4);
    });

    it("should update stats on game completion", () => {
      const key = "us-2025-01-15";
      const game = createTestDailyGame({ region: "us", maxGuesses: 4 });
      useNormalGameStore.getState().setDailyGame(key, game);

      const guess = {
        birdId: "correct",
        correct: true,
        timestamp: Date.now(),
      };

      useNormalGameStore.getState().processGuess(key, guess);

      const stats = useNormalGameStore.getState().stats;
      expect(stats.totalGamesPlayed).toBe(1);
      expect(stats.totalGamesWon).toBe(1);
      expect(stats.currentStreak).toBe(1);
      expect(stats.maxStreak).toBe(1);
      expect(stats.regionStats.us).toBeDefined();
      expect(stats.regionStats.us.gamesPlayed).toBe(1);
      expect(stats.regionStats.us.gamesWon).toBe(1);
    });

    it("should not allow guesses after game completion", () => {
      const key = "us-2025-01-15";
      const game = createTestDailyGame({
        maxGuesses: 4,
        completed: true,
        won: true,
      });
      useNormalGameStore.getState().setDailyGame(key, game);

      const guess = {
        birdId: "testbird",
        correct: false,
        timestamp: Date.now(),
      };

      useNormalGameStore.getState().processGuess(key, guess);

      const retrieved = useNormalGameStore.getState().getDailyGame(key);
      expect(retrieved?.guesses).toHaveLength(0);
    });
  });

  describe("Hard Mode Store", () => {
    beforeEach(() => {
      useNormalGameStore.getState().reset();
      useHardModeStore.getState().reset();
    });

    it("should create a new hard mode game", () => {
      const key = "us-2025-01-15";
      const game = createHardModeGame();

      useHardModeStore.getState().setHardModeGame(key, game);

      const retrieved = useHardModeStore.getState().getHardModeGame(key);
      expect(retrieved).toEqual(game);
      expect(retrieved?.mode).toBe("hard");
      expect(retrieved?.completed).toBe(false);
    });

    it("should add a text guess with taxonomic scoring", () => {
      const key = "us-2025-01-15";
      const game = createHardModeGame();
      useHardModeStore.getState().setHardModeGame(key, game);

      const guess = createHardModeGuess({
        taxonomicScore: {
          order: true,
          family: false,
          genus: false,
          species: false,
        },
      });

      useHardModeStore.getState().processHardModeGuess(key, guess);

      const retrieved = useHardModeStore.getState().getHardModeGame(key);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].textInput).toBe("Test Bird");
      expect(retrieved?.guesses[0].taxonomicScore.order).toBe(true);
    });

    it("should complete hard mode game on correct guess", () => {
      const key = "us-2025-01-15";
      const game = createHardModeGame({ maxGuesses: 6 });
      useHardModeStore.getState().setHardModeGame(key, game);

      const guess = createHardModeGuess({
        correct: true,
        birdId: "correct",
      });

      useHardModeStore.getState().processHardModeGuess(key, guess);

      const retrieved = useHardModeStore.getState().getHardModeGame(key);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it("should update hard mode stats on completion", () => {
      const key = "us-2025-01-15";
      const game = createHardModeGame({ region: "us", maxGuesses: 6 });
      useHardModeStore.getState().setHardModeGame(key, game);

      const guess = createHardModeGuess({ correct: true });

      useHardModeStore.getState().processHardModeGuess(key, guess);

      const stats = useHardModeStore.getState().stats;
      expect(stats.totalGamesPlayed).toBe(1);
      expect(stats.totalGamesWon).toBe(1);
      expect(stats.currentStreak).toBe(1);
      expect(stats.regionStats.us).toBeDefined();
      expect(stats.regionStats.us.gamesPlayed).toBe(1);
      expect(stats.regionStats.us.gamesWon).toBe(1);
    });

    it("should track region-specific stats", () => {
      const key1 = "us-2025-01-15";
      const game1 = createHardModeGame({ region: "us", maxGuesses: 6 });
      useHardModeStore.getState().setHardModeGame(key1, game1);

      const guess = createHardModeGuess({ correct: true });
      useHardModeStore.getState().processHardModeGuess(key1, guess);

      const stats = useHardModeStore.getState().stats;
      expect(stats.regionStats.us).toBeDefined();
      expect(stats.regionStats.us.gamesPlayed).toBe(1);
      expect(stats.regionStats.us.gamesWon).toBe(1);
    });
  });

  describe("State Migration", () => {
    it("should migrate v0 state to v2 format", () => {
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-15",
        guesses: [{ birdId: "test", correct: true, timestamp: Date.now() }],
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

      mockStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const migratedGame = useNormalGameStore
        .getState()
        .getDailyGame("us-2025-01-15");
      expect(migratedGame).toBeDefined();
      expect(migratedGame?.region).toBe("us");
      expect(migratedGame?.date).toBe("2025-01-15");
      expect(migratedGame?.completed).toBe(true);
      expect(migratedGame?.won).toBe(true);
    });

    it("should migrate v1 state to v2 format", () => {
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
          totalGamesPlayed: 0,
          totalGamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          regionStats: {},
        },
      };

      mockStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const migratedGame = useNormalGameStore
        .getState()
        .getDailyGame("us-2025-01-15");
      expect(migratedGame).toBeDefined();
      expect(migratedGame?.region).toBe("us");
    });

    it("should handle migration idempotently", () => {
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-15",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      mockStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();
      useNormalGameStore.getState().migrateFromOldFormat();

      const migratedGame = useNormalGameStore
        .getState()
        .getDailyGame("us-2025-01-15");
      expect(migratedGame).toBeDefined();
    });

    it("should migrate hard mode state from v0 to v2", () => {
      const oldState = {
        region: "eu",
        lastPlayed: "2025-01-15",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
        mode: "hard",
      };

      mockStorage.setItem("audio-birdle-hard-mode", JSON.stringify(oldState));

      useHardModeStore.getState().migrateFromOldFormat();

      const migratedGame = useHardModeStore
        .getState()
        .getHardModeGame("eu-2025-01-15");
      expect(migratedGame).toBeDefined();
      expect(migratedGame?.mode).toBe("hard");
      expect(migratedGame?.region).toBe("eu");
    });

    it("should handle missing fields with defaults during migration", () => {
      const oldState = {
        region: "us",
        lastPlayed: "2025-01-15",
      };

      mockStorage.setItem("audio-birdle-game-state", JSON.stringify(oldState));

      useNormalGameStore.getState().migrateFromOldFormat();

      const migratedGame = useNormalGameStore
        .getState()
        .getDailyGame("us-2025-01-15");
      expect(migratedGame).toBeDefined();
      expect(migratedGame?.guesses).toEqual([]);
      expect(migratedGame?.completed).toBe(false);
      expect(migratedGame?.maxGuesses).toBe(4);
    });
  });

  describe("Cross-Store Isolation", () => {
    beforeEach(() => {
      useNormalGameStore.getState().reset();
      useHardModeStore.getState().reset();
      usePracticeStore.getState().reset();
    });

    it("should keep normal and hard mode stores separate", () => {
      const key = "us-2025-01-15";

      useNormalGameStore.getState().setDailyGame(key, createTestDailyGame());
      useHardModeStore.getState().setHardModeGame(key, createHardModeGame());

      const normalGame = useNormalGameStore.getState().getDailyGame(key);
      const hardModeGame = useHardModeStore.getState().getHardModeGame(key);

      expect(normalGame).toBeDefined();
      expect(hardModeGame).toBeDefined();
      expect(normalGame?.maxGuesses).toBe(4);
      expect(hardModeGame?.maxGuesses).toBe(6);
    });

    it("should keep stats separate for each mode", () => {
      useNormalGameStore
        .getState()
        .setDailyGame("us-2025-01-15", createTestDailyGame());
      useHardModeStore
        .getState()
        .setHardModeGame("us-2025-01-16", createHardModeGame());

      const normalStats = useNormalGameStore.getState().stats;
      const hardModeStats = useHardModeStore.getState().stats;

      expect(normalStats).not.toBe(hardModeStats);
      expect(normalStats.totalGamesPlayed).toBe(0);
      expect(hardModeStats.totalGamesPlayed).toBe(0);
    });

    it("should not persist practice store state", () => {
      const initialGetItems = mockStorage.getStore
        ? Object.keys(mockStorage.getStore()).length
        : 0;

      usePracticeStore.getState().setCurrentBird(createTestBird());

      const afterGetItems = mockStorage.getStore
        ? Object.keys(mockStorage.getStore()).length
        : 0;

      expect(afterGetItems).toBe(initialGetItems);
    });

    it("should reset practice store independently", () => {
      usePracticeStore.getState().setCurrentBird(createTestBird());
      usePracticeStore.getState().addGuess({
        birdId: "test",
        correct: true,
        timestamp: Date.now(),
      });

      expect(usePracticeStore.getState().currentBird).toBeDefined();
      expect(usePracticeStore.getState().guesses).toHaveLength(1);

      usePracticeStore.getState().reset();

      expect(usePracticeStore.getState().currentBird).toBeNull();
      expect(usePracticeStore.getState().guesses).toHaveLength(0);
    });

    it("should not affect practice store when normal store updates", () => {
      const key = "us-2025-01-15";
      usePracticeStore.getState().setCurrentBird(createTestBird());

      useNormalGameStore.getState().setDailyGame(key, createTestDailyGame());

      expect(usePracticeStore.getState().currentBird).toBeDefined();
    });
  });

  describe("Stats Aggregation", () => {
    beforeEach(() => {
      useNormalGameStore.getState().reset();
    });

    it("should aggregate stats across multiple games", () => {
      const game1 = createTestDailyGame({ region: "us", maxGuesses: 4 });
      const game2 = createTestDailyGame({ region: "eu", maxGuesses: 4 });

      useNormalGameStore.getState().setDailyGame("us-2025-01-15", game1);
      useNormalGameStore.getState().setDailyGame("eu-2025-01-15", game2);

      const guess1 = {
        birdId: "correct",
        correct: true,
        timestamp: Date.now(),
      };
      useNormalGameStore.getState().processGuess("us-2025-01-15", guess1);

      const guess2 = {
        birdId: "correct",
        correct: true,
        timestamp: Date.now(),
      };
      useNormalGameStore.getState().processGuess("eu-2025-01-15", guess2);

      const stats = useNormalGameStore.getState().stats;
      expect(stats.totalGamesPlayed).toBe(2);
      expect(stats.totalGamesWon).toBe(2);
      expect(stats.currentStreak).toBe(2);
    });

    it("should reset streak on loss", () => {
      const key = "us-2025-01-15";
      const game = createTestDailyGame({ region: "us", maxGuesses: 4 });
      useNormalGameStore.getState().setDailyGame(key, game);

      for (let i = 0; i < 4; i++) {
        const guess = {
          birdId: `wrong-${i}`,
          correct: false,
          timestamp: Date.now() + i,
        };
        useNormalGameStore.getState().processGuess(key, guess);
      }

      const stats = useNormalGameStore.getState().stats;
      expect(stats.currentStreak).toBe(0);
      expect(stats.totalGamesPlayed).toBe(1);
      expect(stats.totalGamesWon).toBe(0);
    });

    it("should calculate average guesses correctly", () => {
      const key1 = "us-2025-01-15";
      const key2 = "us-2025-01-16";
      const key3 = "us-2025-01-17";

      useNormalGameStore
        .getState()
        .setDailyGame(
          key1,
          createTestDailyGame({ region: "us", maxGuesses: 4 }),
        );
      useNormalGameStore
        .getState()
        .setDailyGame(
          key2,
          createTestDailyGame({ region: "us", maxGuesses: 4 }),
        );
      useNormalGameStore
        .getState()
        .setDailyGame(
          key3,
          createTestDailyGame({ region: "us", maxGuesses: 4 }),
        );

      const guess1 = {
        birdId: "correct",
        correct: true,
        timestamp: Date.now(),
      };
      useNormalGameStore.getState().processGuess(key1, guess1);

      const guess2 = {
        birdId: "correct",
        correct: true,
        timestamp: Date.now() + 1,
      };
      useNormalGameStore.getState().processGuess(key2, guess2);

      const guess3 = {
        birdId: "correct",
        correct: true,
        timestamp: Date.now() + 2,
      };
      useNormalGameStore.getState().processGuess(key3, guess3);

      const stats = useNormalGameStore.getState().stats;
      expect(stats.regionStats.us.totalGuesses).toBe(3);
      expect(stats.regionStats.us.gamesPlayed).toBe(3);
      expect(stats.regionStats.us.averageGuesses).toBe(1);
    });
  });

  describe("Reset Functionality", () => {
    it("should reset normal game store to initial state", () => {
      const key = "us-2025-01-15";
      useNormalGameStore.getState().setDailyGame(key, createTestDailyGame());
      useNormalGameStore.getState().processGuess(key, {
        birdId: "correct",
        correct: true,
        timestamp: Date.now(),
      });

      useNormalGameStore.getState().reset();

      expect(useNormalGameStore.getState().dailyGames).toEqual({});
      expect(useNormalGameStore.getState().stats.totalGamesPlayed).toBe(0);
    });

    it("should reset hard mode store to initial state", () => {
      const key = "us-2025-01-15";
      useHardModeStore.getState().setHardModeGame(key, createHardModeGame());
      useHardModeStore
        .getState()
        .processHardModeGuess(key, createHardModeGuess({ correct: true }));

      useHardModeStore.getState().reset();

      expect(useHardModeStore.getState().hardModeGames).toEqual({});
      expect(useHardModeStore.getState().stats.totalGamesPlayed).toBe(0);
    });
  });
});
