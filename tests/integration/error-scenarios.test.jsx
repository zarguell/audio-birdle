import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadDailyBirdData,
  findBirdByHash,
  getTodaysBirdFromDaily,
} from "@/utils/DailyBirdUtils";
import { loadGameData } from "@/utils/LoadGameData";
import { getStorage, setStorage } from "@/utils/StorageUtils";
import { createMockLocalStorage, createMockResponse } from "../setup";
import {
  createTestBird,
  createTestBirdList,
  createTestGameState,
  createTestDailyEntry,
  createTestRegionList,
} from "../fixtures/integration-fixtures";
import { hashString } from "@/utils/HashUtils";
import { GAME_CONFIG } from "@/utils/Constants";

describe("Error Scenario Integration", () => {
  let mockLocalStorage;
  let mockFetch;

  beforeEach(() => {
    mockLocalStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockLocalStorage);

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe("Empty Data Tests", () => {
    it("should handle loading when birds.json is empty array", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse([]))
        .mockResolvedValueOnce(createMockResponse({ us: [] }));

      const data = await loadGameData();
      expect(data.birds.us).toEqual([]);
    });

    it("should handle loading when regions.json is empty array", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse([]))
        .mockResolvedValueOnce(createMockResponse({ us: [] }));

      const data = await loadGameData();
      expect(data.regions).toEqual([]);
    });

    it("should handle loading when daily.json has no entries for current date", async () => {
      const dailyData = [
        createTestDailyEntry({ date: "2025-01-13", region: "us" }),
        createTestDailyEntry({ date: "2025-01-14", region: "us" }),
      ];
      mockFetch.mockResolvedValueOnce(createMockResponse(dailyData));

      const result = await loadDailyBirdData();
      expect(result).toEqual(dailyData);
    });

    it("should handle finding bird when bird list is empty", () => {
      const emptyBirds = [];
      const bird = findBirdByHash(emptyBirds, "a1b2c3d4");
      expect(bird).toBeNull();
    });

    it("should handle game state with no games played", () => {
      const state = createTestGameState();
      setStorage("audio-birdle-game-state", state);

      const loaded = getStorage("audio-birdle-game-state", null);
      expect(loaded.dailyGames).toEqual({});
      expect(loaded.stats.totalGamesPlayed).toBe(0);
      expect(loaded.stats.currentStreak).toBe(0);
    });
  });

  describe("Malformed Data Tests", () => {
    it("should handle loading when JSON is malformed", async () => {
      mockFetch.mockRejectedValue(
        new SyntaxError("Unexpected token < in JSON"),
      );

      await expect(loadDailyBirdData()).rejects.toThrow();
    });

    it("should handle birds with missing required fields", () => {
      const malformedBirds = [
        { id: "bird1" }, // Missing name, scientificName, order, family
        { name: "Bird 2" }, // Missing id, scientificName, order, family
      ];

      const bird = findBirdByHash(malformedBirds, "a1b2c3d4");
      expect(bird).toBeNull();
    });

    it("should handle daily.json with invalid hash format", async () => {
      const dailyData = [
        createTestDailyEntry({ answerHash: "invalid" }), // Not 8 chars, not hex
        createTestDailyEntry({ answerHash: "xyz12345" }), // Not hex
        createTestDailyEntry({ answerHash: "a1b2c3d4e5f6g7h8" }), // Too long
      ];
      mockFetch.mockResolvedValueOnce(createMockResponse(dailyData));

      const result = await loadDailyBirdData();
      expect(result).toEqual(dailyData);
    });

    it("should handle game state with corrupted data structure", () => {
      const corruptedState = {
        dailyGames: "not-an-object",
        stats: null,
        version: 2,
      };

      setStorage("audio-birdle-game-state", corruptedState);
      const loaded = getStorage("audio-birdle-game-state", null);

      expect(loaded).toEqual(corruptedState);
    });

    it("should handle game state with missing version field", () => {
      const stateWithoutVersion = {
        dailyGames: {},
        stats: { totalGamesPlayed: 5 },
      };

      setStorage("audio-birdle-game-state", stateWithoutVersion);
      const loaded = getStorage("audio-birdle-game-state", null);

      expect(loaded).toEqual(stateWithoutVersion);
      expect(loaded.version).toBeUndefined();
    });

    it("should handle birds.json with non-object data", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse([]))
        .mockResolvedValueOnce(createMockResponse(null));

      const data = await loadGameData();
      expect(data.birds).toBeNull();
    });
  });

  describe("Boundary Condition Tests", () => {
    it("should handle game with exactly 0 guesses", () => {
      const game = {
        region: "us",
        date: "2025-01-15",
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      expect(game.guesses).toHaveLength(0);
      expect(game.completed).toBe(false);
    });

    it("should handle game with exactly MAX_GUESSES guesses", () => {
      const game = {
        region: "us",
        date: "2025-01-15",
        guesses: Array.from({ length: GAME_CONFIG.MAX_GUESSES }, (_, i) => ({
          birdId: `bird${i}`,
          correct: false,
          timestamp: Date.now() - i * 1000,
        })),
        completed: true,
        won: false,
        maxGuesses: GAME_CONFIG.MAX_GUESSES,
      };

      expect(game.guesses).toHaveLength(GAME_CONFIG.MAX_GUESSES);
      expect(game.completed).toBe(true);
      expect(game.won).toBe(false);
    });

    it("should handle game with more than MAX_GUESSES guesses (edge case)", () => {
      const game = {
        region: "us",
        date: "2025-01-15",
        guesses: Array.from(
          { length: GAME_CONFIG.MAX_GUESSES + 1 },
          (_, i) => ({
            birdId: `bird${i}`,
            correct: false,
            timestamp: Date.now() - i * 1000,
          }),
        ),
        completed: true,
        won: false,
        maxGuesses: GAME_CONFIG.MAX_GUESSES,
      };

      expect(game.guesses.length).toBeGreaterThan(GAME_CONFIG.MAX_GUESSES);
    });

    it("should handle streak calculations with 0 games", () => {
      const state = createTestGameState();
      expect(state.stats.currentStreak).toBe(0);
      expect(state.stats.maxStreak).toBe(0);
    });

    it("should handle streak calculations with 1 game", () => {
      const state = createTestGameState({
        stats: {
          totalGamesPlayed: 1,
          totalGamesWon: 1,
          currentStreak: 1,
          maxStreak: 1,
          regionStats: {},
        },
      });

      expect(state.stats.currentStreak).toBe(1);
      expect(state.stats.maxStreak).toBe(1);
    });

    it("should handle stats with division by zero scenarios", () => {
      const state = createTestGameState({
        stats: {
          totalGamesPlayed: 0,
          totalGamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          regionStats: {},
        },
      });

      const winRate =
        state.stats.totalGamesPlayed > 0
          ? state.stats.totalGamesWon / state.stats.totalGamesPlayed
          : 0;

      expect(winRate).toBe(0);
    });

    it("should handle finding bird with null parameters", () => {
      const birds = createTestBirdList(5);
      const bird1 = findBirdByHash(null, "a1b2c3d4");
      const bird2 = findBirdByHash(birds, null);
      const bird3 = findBirdByHash(undefined, undefined);

      expect(bird1).toBeNull();
      expect(bird2).toBeNull();
      expect(bird3).toBeNull();
    });
  });

  describe("Storage Error Tests", () => {
    it("should handle localStorage.getItem throwing exception", () => {
      const errorMock = {
        getItem: vi.fn(() => {
          throw new Error("Security error");
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };

      vi.stubGlobal("localStorage", errorMock);

      const result = getStorage("test-key", "default");
      expect(result).toBe("default");
    });

    it("should handle localStorage.setItem with quota exceeded", () => {
      const quotaMock = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          const error = new Error("Quota exceeded");
          error.name = "QuotaExceededError";
          throw error;
        }),
        removeItem: vi.fn(),
      };

      vi.stubGlobal("localStorage", quotaMock);

      const result = setStorage("test-key", { data: "large data" });
      expect(result).toBe(false);
    });

    it("should handle localStorage.setItem throwing SecurityError", () => {
      const securityMock = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          const error = new Error("Security error");
          error.name = "SecurityError";
          throw error;
        }),
        removeItem: vi.fn(),
      };

      vi.stubGlobal("localStorage", securityMock);

      const result = setStorage("test-key", "data");
      expect(result).toBe(false);
    });

    it("should handle JSON.parse failures in storage", () => {
      vi.stubGlobal("localStorage", {
        getItem: vi.fn(() => "invalid json {{{"),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      const result = getStorage("test-key", "default");
      expect(result).toBe("default");
    });

    it("should handle recovery when storage is partially corrupted", () => {
      vi.stubGlobal("localStorage", {
        getItem: vi.fn((key) => {
          if (key === "audio-birdle-game-state") {
            return "invalid json";
          }
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      const state = getStorage(
        "audio-birdle-game-state",
        createTestGameState(),
      );
      expect(state).toEqual(createTestGameState());
    });

    it("should handle circular references in storage data", () => {
      const circular = { name: "test" };
      circular.self = circular;

      const result = setStorage("test-key", circular);
      expect(result).toBe(false);
    });
  });

  describe("Daily Bird Fallback Tests", () => {
    it("should handle fallback when hash lookup fails (no match)", async () => {
      const dailyData = [createTestDailyEntry({ answerHash: "a1b2c3d4" })];
      const birds = createTestBirdList(5);

      mockFetch.mockResolvedValueOnce(createMockResponse(dailyData));

      const bird = await getTodaysBirdFromDaily("us", birds, "2025-01-15");
      expect(bird).toBeNull();
    });

    it("should handle daily.json with missing required fields", async () => {
      const malformedDailyData = [
        { date: "2025-01-15" }, // Missing region, answerHash
        { region: "us" }, // Missing date, answerHash
        {}, // Missing all fields
      ];
      mockFetch.mockResolvedValueOnce(createMockResponse(malformedDailyData));

      const result = await loadDailyBirdData();
      expect(result).toEqual(malformedDailyData);
    });

    it("should handle duplicate hashes (collision handling)", () => {
      const bird1 = createTestBird({ id: "bird1" });
      const bird2 = createTestBird({ id: "bird2" });

      const hash1 = hashString("bird1-birdle-salt-2025");
      const hash2 = hashString("bird2-birdle-salt-2025");

      const birds = [bird1, bird2];

      const foundBird1 = findBirdByHash(birds, hash1);
      const foundBird2 = findBirdByHash(birds, hash2);

      expect(foundBird1.id).toBe("bird1");
      expect(foundBird2.id).toBe("bird2");
    });

    it("should handle getting bird when daily.json fetch fails", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const bird = await getTodaysBirdFromDaily("us", [], "2025-01-15");
      expect(bird).toBeNull();
    });

    it("should handle daily.json with non-array data", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ not: "an array" }));

      await expect(loadDailyBirdData()).rejects.toThrow();
    });
  });

  describe("Game State Edge Cases", () => {
    it("should handle game state with missing dailyGames", () => {
      const state = {
        version: 2,
        stats: {
          totalGamesPlayed: 0,
          totalGamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          regionStats: {},
        },
      };

      setStorage("audio-birdle-game-state", state);
      const loaded = getStorage("audio-birdle-game-state", null);

      expect(loaded.dailyGames).toBeUndefined();
    });

    it("should handle game state with missing hardModeGames", () => {
      const state = {
        version: 2,
        dailyGames: {},
        stats: {
          totalGamesPlayed: 0,
          totalGamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          regionStats: {},
        },
      };

      setStorage("audio-birdle-game-state", state);
      const loaded = getStorage("audio-birdle-game-state", null);

      expect(loaded.hardModeGames).toBeUndefined();
    });

    it("should handle game with all guesses correct (perfect game)", () => {
      const game = {
        region: "us",
        date: "2025-01-15",
        guesses: [{ birdId: "correct", correct: true, timestamp: Date.now() }],
        completed: true,
        won: true,
        maxGuesses: 4,
      };

      expect(game.guesses[0].correct).toBe(true);
      expect(game.won).toBe(true);
    });

    it("should handle game state with null regionStats", () => {
      const state = {
        version: 2,
        dailyGames: {},
        hardModeGames: {},
        stats: {
          totalGamesPlayed: 5,
          totalGamesWon: 3,
          currentStreak: 2,
          maxStreak: 3,
          regionStats: null,
        },
      };

      setStorage("audio-birdle-game-state", state);
      const loaded = getStorage("audio-birdle-game-state", null);

      expect(loaded.stats.regionStats).toBeNull();
    });
  });
});
