import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  #data = new Map();

  get length() {
    return this.#data.size;
  }

  clear() {
    this.#data.clear();
  }

  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }

  setItem(key, value) {
    this.#data.set(key, String(value));
  }

  removeItem(key) {
    this.#data.delete(key);
  }

  key(index) {
    return Array.from(this.#data.keys())[index] ?? null;
  }
}

const storage = new MemoryStorage();
globalThis.window = { localStorage: storage };

const state = await import("../../sitegen/static/js/core/gameState.js");

test("a completed daily game updates stats once and resets cleanly", () => {
  state.resetAll();
  state.ensureDailyGame("us", "2026-11-24", "normal");
  const key = state.gameKey("us", "2026-11-24", "normal");
  state.processGuess(key, { birdId: "amerob", correct: true, timestamp: 1 });

  const stats = state.getStats();
  assert.equal(stats.totalGamesPlayed, 1);
  assert.equal(stats.totalGamesWon, 1);
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.regionStats.us.gamesPlayed, 1);
  assert.equal(stats.regionStats.us.averageGuesses, 1);

  const persisted = JSON.parse(storage.getItem("audio-birdle-game"));
  assert.equal(persisted.version, 2);
  assert.equal(persisted.state.stats.totalGamesPlayed, 1);

  state.resetToday("us", "2026-11-24");
  assert.equal(state.getDailyGame(key).guesses.length, 0);
  assert.equal(state.getStats().totalGamesPlayed, 1);

  state.processGuess(key, { birdId: "amerob", correct: true, timestamp: 2 });
  assert.equal(state.getStats().totalGamesPlayed, 1);

  state.resetAll();
  assert.equal(state.getStats().totalGamesPlayed, 0);
  assert.deepEqual(state.getAllGames(), {});
});

test("legacy v0 game state is imported into the version-2 envelope", async () => {
  storage.clear();
  storage.setItem(
    "audio-birdle-game-state",
    JSON.stringify({
      region: "us",
      lastPlayed: "2026-11-20",
      guesses: [{ birdId: "amerob", correct: true, timestamp: 1 }],
      completed: true,
      won: true,
      maxGuesses: 4,
    }),
  );

  const legacy = await import(
    "../../sitegen/static/js/core/gameState.js?legacy-v0"
  );
  const game = legacy.getDailyGame("us-2026-11-20-normal");
  assert.ok(game);
  assert.equal(game.mode, "normal");
  assert.equal(game.completed, true);
  assert.equal(game.statsApplied, true);
  assert.equal(storage.getItem("audio-birdle-game-state"), null);
});

test("former zustand stores migrate their games and stats", async () => {
  storage.clear();
  storage.setItem(
    "audio-birdle-normal-game",
    JSON.stringify({
      state: {
        dailyGames: {
          "us-2026-11-21": {
            region: "us",
            date: "2026-11-21",
            mode: "normal",
            guesses: [{ birdId: "amerob", correct: true, timestamp: 1 }],
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
          regionStats: {
            us: {
              gamesPlayed: 1,
              gamesWon: 1,
              totalGuesses: 1,
              averageGuesses: 1,
            },
          },
        },
      },
      version: 1,
    }),
  );

  const legacy = await import(
    "../../sitegen/static/js/core/gameState.js?legacy-zustand"
  );
  assert.ok(legacy.getDailyGame("us-2026-11-21-normal"));
  assert.equal(legacy.getStats().totalGamesPlayed, 1);
  assert.equal(storage.getItem("audio-birdle-normal-game"), null);
});
