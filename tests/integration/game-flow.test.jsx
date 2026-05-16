/**
 * Game Flow Integration Tests
 *
 * These tests verify the complete game flow from data loading through
 * game state management and persistence. They test the integration
 * of multiple utility modules working together.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  processGuess,
  getUserPerformanceSummary,
  createRegionDateKey,
} from "@/utils/GameLogic";
import { getStorage, setStorage } from "@/utils/StorageUtils";
import { useGameStore } from "@/stores/gameStore";

// Mock localStorage for testing
const mockLocalStorage = {
  storage: {},
  getItem(key) {
    return this.storage[key] || null;
  },
  setItem(key, value) {
    this.storage[key] = value;
  },
  removeItem(key) {
    delete this.storage[key];
  },
  clear() {
    this.storage = {};
  },
};

describe("Game Flow Integration Tests", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    mockLocalStorage.clear();
    vi.stubGlobal("localStorage", mockLocalStorage);

    // Reset Zustand stores to prevent test pollution
    useGameStore.getState().reset();
  });

  describe("Complete Daily Game Flow", () => {
    it("should process multiple guesses and track stats correctly", () => {
      const region = "us";
      const date = "2025-01-15";
      const testBird = {
        id: "amerob",
        name: "American Robin",
        family: "Turdidae (Turdidae)",
      };

      let gameState = {
        dailyGames: {},
        stats: {
          totalGamesPlayed: 0,
          totalGamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          regionStats: {},
        },
        lastPlayed: null,
        version: 2,
      };

      // First guess - incorrect
      gameState = processGuess(gameState, region, date, "mallar3", testBird.id);
      expect(gameState.dailyGames[`${region}-${date}-normal`].guesses).toHaveLength(1);
      expect(gameState.dailyGames[`${region}-${date}-normal`].guesses[0].correct).toBe(
        false,
      );
      expect(gameState.dailyGames[`${region}-${date}-normal`].completed).toBe(false);

      // Second guess - incorrect
      gameState = processGuess(gameState, region, date, "horlar", testBird.id);
      expect(gameState.dailyGames[`${region}-${date}-normal`].guesses).toHaveLength(2);
      expect(gameState.dailyGames[`${region}-${date}-normal`].completed).toBe(false);

      // Third guess - correct
      gameState = processGuess(
        gameState,
        region,
        date,
        testBird.id,
        testBird.id,
      );
      expect(gameState.dailyGames[`${region}-${date}-normal`].guesses).toHaveLength(3);
      expect(gameState.dailyGames[`${region}-${date}-normal`].guesses[2].correct).toBe(
        true,
      );
      expect(gameState.dailyGames[`${region}-${date}-normal`].completed).toBe(true);
      expect(gameState.dailyGames[`${region}-${date}-normal`].won).toBe(true);
    });

    it("should handle game loss after max guesses", () => {
      const region = "us";
      const date = "2025-01-15";
      const testBird = {
        id: "amerob",
        name: "American Robin",
        family: "Turdidae (Turdidae)",
      };

      let gameState = {
        dailyGames: {},
        stats: {
          totalGamesPlayed: 0,
          totalGamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          regionStats: {},
        },
        lastPlayed: null,
        version: 2,
      };

      // Make 4 incorrect guesses
      for (let i = 0; i < 4; i++) {
        gameState = processGuess(
          gameState,
          region,
          date,
          `wrong-bird-${i}`,
          testBird.id,
        );
      }

      expect(gameState.dailyGames[`${region}-${date}-normal`].guesses).toHaveLength(4);
      expect(gameState.dailyGames[`${region}-${date}-normal`].completed).toBe(true);
      expect(gameState.dailyGames[`${region}-${date}-normal`].won).toBe(false);
    });
  });

  describe("State Persistence", () => {
    it("should save and load state correctly", () => {
      const testState = {
        version: 2,
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
          totalGamesPlayed: 5,
          totalGamesWon: 3,
          currentStreak: 2,
          maxStreak: 3,
          regionStats: {
            us: { gamesPlayed: 5, gamesWon: 3, averageGuesses: 2.5 },
          },
        },
      };

      setStorage("game-state", testState);
      const loadedState = getStorage("game-state");

      expect(loadedState).toEqual(testState);
    });
  });

  describe("Statistics Aggregation", () => {
    it("should calculate performance summary correctly", () => {
      const complexState = {
        version: 2,
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
          "us-2025-01-14": {
            region: "us",
            date: "2025-01-14",
            guesses: [
              { birdId: "wrong1", correct: false, timestamp: Date.now() },
              { birdId: "wrong2", correct: false, timestamp: Date.now() },
              { birdId: "correct", correct: true, timestamp: Date.now() },
            ],
            completed: true,
            won: true,
            maxGuesses: 4,
          },
          "eu-2025-01-15": {
            region: "eu",
            date: "2025-01-15",
            guesses: [
              { birdId: "wrong1", correct: false, timestamp: Date.now() },
              { birdId: "wrong2", correct: false, timestamp: Date.now() },
              { birdId: "wrong3", correct: false, timestamp: Date.now() },
              { birdId: "wrong4", correct: false, timestamp: Date.now() },
            ],
            completed: true,
            won: false,
            maxGuesses: 4,
          },
        },
        stats: {
          totalGamesPlayed: 3,
          totalGamesWon: 2,
          averageGuesses: 2.67,
          currentStreak: 1,
          maxStreak: 2,
          regionStats: {
            us: {
              gamesPlayed: 2,
              gamesWon: 2,
              totalGuesses: 4,
              averageGuesses: 2,
            },
            eu: {
              gamesPlayed: 1,
              gamesWon: 0,
              totalGuesses: 4,
              averageGuesses: 4,
            },
          },
        },
      };

      const summary = getUserPerformanceSummary(complexState);

      expect(summary.totalGames).toBe(3);
      expect(summary.winRate).toBe("66.7");
      expect(summary.averageGuesses).toBe("2.7");
      expect(summary.currentStreak).toBe(1);
      expect(summary.maxStreak).toBe(2);
      expect(summary.regionBreakdown).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle corrupted localStorage gracefully", () => {
      mockLocalStorage.storage["game-state"] = "invalid-json{{{";

      const loadedData = getStorage("game-state", null);
      expect(loadedData).toBeNull();

      // Should handle null gracefully
      expect(loadedData).toBeNull();
    });

    it("should handle missing localStorage keys", () => {
      const data = getStorage("non-existent-key", null);
      expect(data).toBeNull();
    });
  });
});
