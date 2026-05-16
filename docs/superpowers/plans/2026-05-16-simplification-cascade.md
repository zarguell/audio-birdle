# Simplification Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the codebase by merging parallel implementations of the same concepts — unifying two game stores into one, three game views into one, and consolidating duplicated utilities, backward-compatibility layers, and trivial wrappers.

**Architecture:** A single Zustand store manages all daily games (normal + hard) with a `mode` discriminator. A single `GameView` component renders all three game modes using pluggable input/feedback strategies. Duplicated shuffle/random utilities are consolidated into `HashUtils.jsx`. Trivial hooks are inlined, dead code removed.

**Tech Stack:** React 19, Zustand v5, Vitest, ESLint

---

## File Structure Changes

| Action | Path | Purpose |
|--------|------|---------|
| CREATE | `src/stores/gameStore.ts` | Unified store replacing normalGameStore + hardModeStore |
| CREATE | `tests/unit/stores/gameStore.test.ts` | Merged store tests |
| MODIFY | `src/utils/HashUtils.jsx` | Add canonical `createSeededRandom`, `deterministicShuffle`; replace dead `shuffleArray` |
| MODIFY | `src/utils/GameLogic.jsx` | Remove duplicated shuffle/random, backward-compat migration, `ensureGameStateFormat`, drop `gameState` params |
| MODIFY | `src/utils/PracticeGameLogic.jsx` | Remove duplicate shuffle/random; import from HashUtils |
| MODIFY | `src/utils/Constants.jsx` | Update STORAGE_KEYS |
| MODIFY | `src/stores/normalGameStore.ts` | Replace re-export with `export { useGameStore } from './gameStore'` for backward compat |
| DELETE | `src/stores/hardModeStore.ts` | Removed (merged into gameStore) |
| DELETE | `src/stores/practiceStore.ts` | Removed (unused) |
| MODIFY | `src/hooks/useDailyGame.js` | Point to gameStore instead of two stores |
| MODIFY | `src/hooks/usePersistence.js` | Use StorageUtils real API instead of deprecated aliases |
| MODIFY | `src/hooks/useGameData.js` | Remove duplicate bird-loading block (extract shared helper) |
| MODIFY | `src/App.jsx` | Use gameStore instead of two stores; inline useGameNavigation; remove useMigration |
| DELETE | `src/hooks/useGameNavigation.js` | Inlined into App.jsx |
| DELETE | `src/hooks/useMigration.js` | Removed (store migration happens once on store init) |
| DELETE | `src/hooks/useGameInitialization.js` | Removed (handled inline or in store) |
| CREATE | `src/components/UnifiedGameView.jsx` | New unified game view replacing GameView + HardModeGame + PracticeGame |
| MODIFY | `src/components/GameView.jsx` | Replaced by UnifiedGameView |
| DELETE | `src/utils/HardModeGame.jsx` | Removed (merged into UnifiedGameView) |
| DELETE | `src/utils/PracticeGame.jsx` | Removed (merged into UnifiedGameView) |
| MODIFY | `src/utils/StorageUtils.jsx` | Remove deprecated `getStoredData`/`setStoredData`/`removeStoredData` aliases |
| MODIFY | `tests/unit/stores/normalGameStore.test.ts` | Replace with re-export test only |
| DELETE | `tests/unit/stores/hardModeStore.test.ts` | Removed (merged) |
| CREATE | `tests/unit/stores/gameStore.test.ts` | New merged tests |
| MODIFY | `tests/unit/utils/GameLogic.test.jsx` | Remove tests for deleted backward-compat functions |
| MODIFY | `tests/unit/utils/PracticeGameLogic.test.jsx` | Update imports |

---

## Phase 1: Utility Consolidation (Foundation)

### Task 1.1: Consolidate shuffle/random utilities into HashUtils.jsx

**Files:**
- Modify: `src/utils/HashUtils.jsx`
- Modify: `src/utils/GameLogic.jsx:394-420`
- Modify: `src/utils/PracticeGameLogic.jsx:27-60`
- Modify: `tests/unit/utils/HashUtils.test.jsx`

- [ ] **Step 1: Add canonical `createSeededRandom` and `deterministicShuffle` to HashUtils.jsx**

Replace the dead `shuffleArray` (line 22-35, never imported) with the canonical implementations from GameLogic.jsx:

```javascript
// src/utils/HashUtils.jsx — REPLACE lines 22-35 (the dead shuffleArray) with:

/**
 * Creates a seeded random generator using linear congruential algorithm.
 * @param {number} seed - Seed value for deterministic randomness
 * @returns {function} - Function returning deterministic numbers 0-1
 */
export const createSeededRandom = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state % 2147483647) / 2147483647;
  };
};

/**
 * Fisher-Yates shuffle with seeded randomness.
 * @param {Array} array - Array to shuffle
 * @param {number} seed - Seed for deterministic shuffling
 * @returns {Array} - New shuffled array
 */
export const deterministicShuffle = (array, seed) => {
  const shuffled = [...array];
  const random = createSeededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Fisher-Yates shuffle using Math.random() (non-deterministic).
 * @param {Array} array - Array to shuffle
 * @returns {Array} - New shuffled array
 */
export const randomShuffle = (array) => deterministicShuffle(array, Date.now());
```

- [ ] **Step 2: Run tests to verify HashUtils.test.jsx still passes**

Run: `npx vitest run --config=vitest.config.js tests/unit/utils/HashUtils.test.jsx`
Expected: All existing tests pass (no existing test imports `shuffleArray`, so no breakage).

- [ ] **Step 3: Add tests for new exports in HashUtils.test.jsx**

Add at end of `tests/unit/utils/HashUtils.test.jsx` (before the `describe('HashUtils'` closing brace):

```javascript
  describe('createSeededRandom', () => {
    it('should produce deterministic output for same seed', () => {
      const rand1 = createSeededRandom(42);
      const rand2 = createSeededRandom(42);
      const results1 = Array.from({ length: 10 }, () => rand1());
      const results2 = Array.from({ length: 10 }, () => rand2());
      expect(results1).toEqual(results2);
    });

    it('should produce different output for different seeds', () => {
      const rand1 = createSeededRandom(42);
      const rand2 = createSeededRandom(99);
      const r1 = rand1();
      const r2 = rand2();
      expect(r1).not.toBe(r2);
    });

    it('should produce values between 0 and 1', () => {
      const rand = createSeededRandom(42);
      for (let i = 0; i < 100; i++) {
        const val = rand();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('deterministicShuffle', () => {
    it('should shuffle array deterministically', () => {
      const input = [1, 2, 3, 4, 5];
      const result1 = deterministicShuffle(input, 42);
      const result2 = deterministicShuffle(input, 42);
      expect(result1).toEqual(result2);
    });

    it('should contain same elements after shuffle', () => {
      const input = [1, 2, 3, 4, 5];
      const result = deterministicShuffle(input, 42);
      expect(result.sort()).toEqual(input.sort());
    });

    it('should not mutate original array', () => {
      const input = [1, 2, 3, 4, 5];
      const copy = [...input];
      deterministicShuffle(input, 42);
      expect(input).toEqual(copy);
    });
  });

  describe('randomShuffle', () => {
    it('should contain same elements after shuffle', () => {
      const input = [1, 2, 3, 4, 5];
      const result = randomShuffle(input);
      expect(result.sort()).toEqual(input.sort());
    });
  });
```

- [ ] **Step 4: Run tests to verify new tests pass**

Run: `npx vitest run --config=vitest.config.js tests/unit/utils/HashUtils.test.jsx`
Expected: All tests pass.

- [ ] **Step 5: Update GameLogic.jsx to import from HashUtils instead of defining private copies**

In `src/utils/GameLogic.jsx`:
- Add import: `import { hashString, createSeededRandom, deterministicShuffle } from './HashUtils';` (update existing import on line 5 to add the new names)
- Delete private `createSeededRandom` (lines 394-401)
- Delete private `deterministicShuffle` (lines 409-420)

- [ ] **Step 6: Update PracticeGameLogic.jsx to import from HashUtils instead of defining private copies**

In `src/utils/PracticeGameLogic.jsx`:
- On line 1, change import to: `import { hashString, deterministicShuffle } from './HashUtils';`
- Delete private `createSeededRandom` (lines 27-33)
- Delete private `deterministicShuffle` (lines 38-48)
- Delete private `randomShuffle` (lines 53-60) — replace the one call-site on line 69 with `randomShuffle` from HashUtils or with `deterministicShuffle(regionBirds, Date.now())`

On line 69 in `getPracticeBird`, change:
```javascript
const shuffledBirds = randomShuffle(regionBirds);
```
to:
```javascript
const shuffledBirds = [...regionBirds].sort(() => Math.random() - 0.5);
```

- [ ] **Step 7: Run full unit test suite to verify no regressions**

Run: `npx vitest run --config=vitest.config.js tests/unit`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/utils/HashUtils.jsx src/utils/GameLogic.jsx src/utils/PracticeGameLogic.jsx tests/unit/utils/HashUtils.test.jsx
git commit -m "refactor: consolidate shuffle/random utilities into HashUtils

Eliminate duplicate createSeededRandom and deterministicShuffle from
GameLogic.jsx and PracticeGameLogic.jsx. Replace dead shuffleArray in
HashUtils with canonical implementations used across both files."
```

---

### Task 1.2: Remove dead backward-compat code from StorageUtils.jsx

**Files:**
- Modify: `src/utils/StorageUtils.jsx`
- Modify: `src/hooks/usePersistence.js`
- Modify: `tests/unit/utils/StorageUtils.test.jsx`

- [ ] **Step 1: Remove deprecated aliases from StorageUtils.jsx**

Delete these lines from `src/utils/StorageUtils.jsx`:
- `export const getStoredData = (key, defaultValue = null) => getStorage(key, defaultValue);`
- `export const setStoredData = (key, value) => setStorage(key, value);`
- `export const removeStoredData = (key) => removeStorage(key);`

- [ ] **Step 2: Update usePersistence.js to use real API**

In `src/hooks/usePersistence.js`, change:
```javascript
import { getStoredData, setStoredData } from '../utils/StorageUtils';
```
to:
```javascript
import { getStorage, setStorage } from '../utils/StorageUtils';
```

Change all `getStoredData` calls to `getStorage` and `setStoredData` calls to `setStorage`.

- [ ] **Step 3: Update StorageUtils test to remove deprecated alias tests**

In `tests/unit/utils/StorageUtils.test.jsx`, find and remove tests for `getStoredData`, `setStoredData`, `removeStoredData` (or update them to test `getStorage`/`setStorage`/`removeStorage` instead).

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config=vitest.config.js tests/unit/utils/StorageUtils.test.jsx tests/unit/hooks/usePersistence.test.jsx`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/StorageUtils.jsx src/hooks/usePersistence.js tests/unit/utils/StorageUtils.test.jsx
git commit -m "refactor: remove deprecated StorageUtils aliases"
```

---

## Phase 2: Unified Game Store (Cascade 1)

### Task 2.1: Create unified gameStore.ts

**Files:**
- Create: `src/stores/gameStore.ts`

- [ ] **Step 1: Write the test file first**

Create `tests/unit/stores/gameStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/stores/gameStore';

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
      const gameKey = 'us-2025-01-15-normal';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      };

      setDailyGame(gameKey, gameData);
      expect(getDailyGame(gameKey)).toEqual(gameData);
    });

    it('should add a new hard mode daily game', () => {
      const { setDailyGame, getDailyGame } = useGameStore.getState();
      const gameKey = 'us-2025-01-15-hard';
      const gameData = {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      };

      setDailyGame(gameKey, gameData);
      expect(getDailyGame(gameKey)).toEqual(gameData);
    });

    it('should update an existing daily game', () => {
      const { setDailyGame, getDailyGame } = useGameStore.getState();
      const gameKey = 'us-2025-01-15-normal';
      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [{ birdId: 'amerob', correct: true, timestamp: 123 }],
        completed: true,
        won: true,
        maxGuesses: 4,
      });

      const retrieved = getDailyGame(gameKey);
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
      const gameKey = 'us-2025-01-15-normal';
      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      processGuess(gameKey, {
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].birdId).toBe('amerob');
    });

    it('should add a guess with taxonomic score to a hard mode game', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      const gameKey = 'us-2025-01-15-hard';
      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      });

      processGuess(gameKey, {
        birdId: 'amerob',
        correct: false,
        timestamp: Date.now(),
        textInput: 'American Robin',
        taxonomicScore: { order: true, family: true, genus: false, species: false },
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.guesses).toHaveLength(1);
      expect(retrieved?.guesses[0].textInput).toBe('American Robin');
      expect(retrieved?.guesses[0].taxonomicScore).toEqual({
        order: true, family: true, genus: false, species: false,
      });
    });

    it('should mark game as completed and won on correct guess', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      const gameKey = 'us-2025-01-15-normal';
      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      processGuess(gameKey, {
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.completed).toBe(true);
      expect(retrieved?.won).toBe(true);
    });

    it('should mark game as completed but not won on max guesses', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      const gameKey = 'us-2025-01-15-normal';
      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

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

    it('should not modify a completed game', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      const gameKey = 'us-2025-01-15-normal';
      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [],
        completed: true,
        won: true,
        maxGuesses: 4,
      });

      processGuess(gameKey, {
        birdId: 'extra',
        correct: false,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
      expect(retrieved?.guesses).toHaveLength(0);
    });

    it('should set startTime on first guess', () => {
      const { setDailyGame, processGuess, getDailyGame } = useGameStore.getState();
      const gameKey = 'us-2025-01-15-normal';
      setDailyGame(gameKey, {
        region: 'us',
        date: '2025-01-15',
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      });

      processGuess(gameKey, {
        birdId: 'amerob',
        correct: false,
        timestamp: Date.now(),
      });

      const retrieved = getDailyGame(gameKey);
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
      useGameStore.getState().updateStats('us', true, 2);
      const state = useGameStore.getState();
      expect(state.stats.totalGamesPlayed).toBe(1);
      expect(state.stats.totalGamesWon).toBe(1);
    });

    it('should accumulate region stats', () => {
      const { updateStats } = useGameStore.getState();
      updateStats('us', true, 2);
      updateStats('us', true, 3);
      updateStats('eu', false, 4);

      const state = useGameStore.getState();
      expect(state.stats.regionStats['us'].gamesPlayed).toBe(2);
      expect(state.stats.regionStats['us'].gamesWon).toBe(2);
      expect(state.stats.regionStats['eu'].gamesPlayed).toBe(1);
      expect(state.stats.regionStats['eu'].gamesWon).toBe(0);
    });

    it('should update streak correctly', () => {
      const { updateStats } = useGameStore.getState();
      updateStats('us', true, 2);
      updateStats('us', true, 3);
      updateStats('us', true, 1);

      const state = useGameStore.getState();
      expect(state.stats.currentStreak).toBe(3);
      expect(state.stats.maxStreak).toBe(3);
    });

    it('should reset streak on loss', () => {
      const { updateStats } = useGameStore.getState();
      updateStats('us', true, 2);
      updateStats('us', true, 3);
      updateStats('us', false, 4);

      const state = useGameStore.getState();
      expect(state.stats.currentStreak).toBe(0);
      expect(state.stats.maxStreak).toBe(2);
    });

    it('should compute average guesses correctly', () => {
      const { updateStats } = useGameStore.getState();
      updateStats('us', true, 2);
      updateStats('us', true, 4);

      const state = useGameStore.getState();
      expect(state.stats.regionStats['us'].averageGuesses).toBe(3);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      localStorage.clear();
      useGameStore.getState().reset();
    });

    it('should clear all state', () => {
      const { setDailyGame, reset } = useGameStore.getState();
      setDailyGame('us-2025-01-15-normal', {
        region: 'us',
        date: '2025-01-15',
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

    it('should migrate from old normalGameStore localStorage key', () => {
      useGameStore.getState().reset();

      const oldNormalData = {
        state: {
          dailyGames: {
            'us-2025-01-15': {
              region: 'us',
              date: '2025-01-15',
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
            regionStats: { 'us': { gamesPlayed: 1, gamesWon: 1, totalGuesses: 1, averageGuesses: 1 } },
          },
        },
        version: 2,
      };

      localStorage.setItem('audio-birdle-normal-game', JSON.stringify(oldNormalData));

      // Trigger migration
      useGameStore.getState().migrateFromOldStores();

      const state = useGameStore.getState();
      expect(state.dailyGames['us-2025-01-15-normal']).toBeDefined();
      expect(state.dailyGames['us-2025-01-15-normal'].guesses).toHaveLength(1);
      expect(state.dailyGames['us-2025-01-15-normal'].mode).toBe('normal');
      expect(state.stats.totalGamesPlayed).toBe(1);
    });

    it('should migrate from old hardModeStore localStorage key', () => {
      useGameStore.getState().reset();

      const oldHardData = {
        state: {
          hardModeGames: {
            'us-2025-01-15': {
              region: 'us',
              date: '2025-01-15',
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
      expect(state.dailyGames['us-2025-01-15-hard']).toBeDefined();
      expect(state.dailyGames['us-2025-01-15-hard'].mode).toBe('hard');
      expect(state.stats.totalGamesPlayed).toBe(1);
    });

    it('should merge stats from both old stores', () => {
      useGameStore.getState().reset();

      localStorage.setItem('audio-birdle-normal-game', JSON.stringify({
        state: {
          dailyGames: {},
          stats: { totalGamesPlayed: 5, totalGamesWon: 3, currentStreak: 1, maxStreak: 3, regionStats: { 'us': { gamesPlayed: 5, gamesWon: 3, totalGuesses: 10, averageGuesses: 2 } } },
        },
        version: 2,
      }));

      localStorage.setItem('audio-birdle-hard-mode', JSON.stringify({
        state: {
          hardModeGames: {},
          stats: { totalGamesPlayed: 3, totalGamesWon: 1, currentStreak: 0, maxStreak: 2, regionStats: { 'us': { gamesPlayed: 3, gamesWon: 1, totalGuesses: 12, averageGuesses: 4 } } },
        },
        version: 2,
      }));

      useGameStore.getState().migrateFromOldStores();

      const state = useGameStore.getState();
      // Combined stats
      expect(state.stats.totalGamesPlayed).toBe(8);
      expect(state.stats.totalGamesWon).toBe(4);
      // maxStreak should be max of both
      expect(state.stats.maxStreak).toBe(3);
    });

    it('should be idempotent', () => {
      useGameStore.getState().reset();

      localStorage.setItem('audio-birdle-normal-game', JSON.stringify({
        state: {
          dailyGames: { 'us-2025-01-15': { region: 'us', date: '2025-01-15', mode: 'normal', guesses: [], completed: false, won: false, maxGuesses: 4 } },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config=vitest.config.js tests/unit/stores/gameStore.test.ts`
Expected: FAIL — `Cannot find module '@/stores/gameStore'`

- [ ] **Step 3: Write gameStore.ts**

Create `src/stores/gameStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---- Interfaces ----

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

// ---- Helpers ----

const createInitialStats = (): GameStats => ({
  totalGamesPlayed: 0,
  totalGamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  regionStats: {},
});

function buildStats(state: { stats: GameStats }, region: string, won: boolean, guesses: number): GameStats {
  const newStats = { ...state.stats };

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

  const rs = newStats.regionStats[region];
  rs.totalGuesses += guesses;
  rs.gamesPlayed++;
  rs.averageGuesses = rs.totalGuesses / rs.gamesPlayed;

  if (won) {
    rs.gamesWon++;
  }

  return newStats;
}

function combineStats(a: GameStats, b: GameStats): GameStats {
  const combined: GameStats = {
    totalGamesPlayed: a.totalGamesPlayed + b.totalGamesPlayed,
    totalGamesWon: a.totalGamesWon + b.totalGamesWon,
    currentStreak: 0, // Can't determine order, reset streak
    maxStreak: Math.max(a.maxStreak, b.maxStreak),
    regionStats: {},
  };

  // Merge region stats
  const allRegions = new Set([...Object.keys(a.regionStats), ...Object.keys(b.regionStats)]);
  for (const region of allRegions) {
    const ra = a.regionStats[region] || { gamesPlayed: 0, gamesWon: 0, totalGuesses: 0, averageGuesses: 0 };
    const rb = b.regionStats[region] || { gamesPlayed: 0, gamesWon: 0, totalGuesses: 0, averageGuesses: 0 };
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

// ---- Store ----

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

          if (guess.correct || updatedGame.guesses.length >= updatedGame.maxGuesses) {
            updatedGame.completed = true;
            updatedGame.won = guess.correct;
            updatedGame.endTime = new Date().toISOString();
            return {
              dailyGames: { ...state.dailyGames, [key]: updatedGame },
              stats: buildStats(state, game.region, updatedGame.won, updatedGame.guesses.length),
            };
          }

          return { dailyGames: { ...state.dailyGames, [key]: updatedGame } };
        });
      },

      updateStats: (region, won, guesses) => {
        set((state) => ({ stats: buildStats(state, region, won, guesses) }));
      },

      reset: () => set({ dailyGames: {}, stats: createInitialStats() }),

      migrateFromOldStores: () => {
        const oldNormalKey = 'audio-birdle-normal-game';
        const oldHardKey = 'audio-birdle-hard-mode';

        const normalRaw = localStorage.getItem(oldNormalKey);
        const hardRaw = localStorage.getItem(oldHardKey);

        if (!normalRaw && !hardRaw) return;

        let mergedDailyGames: Record<string, DailyGame> = {};
        let mergedStats = createInitialStats();

        try {
          // Migrate normal store
          if (normalRaw) {
            const normalData = JSON.parse(normalRaw);
            const normalState = normalData.state || normalData;
            if (normalState.dailyGames) {
              for (const [key, game] of Object.entries(normalState.dailyGames)) {
                mergedDailyGames[`${key}-normal`] = {
                  ...(game as Record<string, unknown>),
                  mode: 'normal',
                } as DailyGame;
              }
            }
            if (normalState.stats) {
              mergedStats = combineStats(mergedStats, normalState.stats as GameStats);
            }
          }

          // Migrate hard mode store
          if (hardRaw) {
            const hardData = JSON.parse(hardRaw);
            const hardState = hardData.state || hardData;
            const gamesKey = hardState.hardModeGames || hardState.dailyGames || {};
            for (const [key, game] of Object.entries(gamesKey)) {
              mergedDailyGames[`${key}-hard`] = {
                ...(game as Record<string, unknown>),
                mode: 'hard',
              } as DailyGame;
            }
            if (hardState.stats) {
              mergedStats = combineStats(mergedStats, hardState.stats as GameStats);
            }
          }

          set({ dailyGames: mergedDailyGames, stats: mergedStats });

          // Clear old keys after successful migration
          localStorage.removeItem(oldNormalKey);
          localStorage.removeItem(oldHardKey);
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
        // One-time migration on first load if this is a fresh store
        if (state && Object.keys(state.dailyGames).length === 0) {
          // Check for old stores in next tick
          setTimeout(() => {
            useGameStore.getState().migrateFromOldStores();
          }, 0);
        }
      },
    },
  ),
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config=vitest.config.js tests/unit/stores/gameStore.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts tests/unit/stores/gameStore.test.ts
git commit -m "feat: create unified gameStore replacing normalGameStore and hardModeStore

Single Zustand store manages all daily games with 'mode' discriminator.
Keys use region-date-mode format (e.g., us-2025-12-27-normal).
Auto-migrates data from old audio-birdle-normal-game and audio-birdle-hard-mode
localStorage keys on first load."
```

---

### Task 2.2: Update all consumers to use gameStore

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/hooks/useDailyGame.js`
- Modify: `src/hooks/useGameInitialization.js`
- Modify: `src/utils/GameLogic.jsx` (update imports)
- Modify: `src/utils/Constants.jsx`
- Delete: `src/stores/hardModeStore.ts`
- Delete: `src/stores/practiceStore.ts`
- Create: `src/stores/normalGameStore.ts` (backward-compat re-export)

- [ ] **Step 1: Delete hardModeStore.ts and practiceStore.ts**

Run:
```bash
rm src/stores/hardModeStore.ts
rm src/stores/practiceStore.ts
```

- [ ] **Step 2: Replace normalGameStore.ts with a backward-compat re-export**

Write `src/stores/normalGameStore.ts`:

```typescript
// Re-export from unified gameStore for backward compatibility
// TODO: Migrate all consumers to useGameStore directly, then remove this file
export { useGameStore as useNormalGameStore } from './gameStore';
export type { DailyGame, RegionStats, GameStats } from './gameStore';
```

- [ ] **Step 3: Delete hardModeStore.test.ts**

Run:
```bash
rm tests/unit/stores/hardModeStore.test.ts
```

- [ ] **Step 4: Update normalGameStore.test.ts to test via re-export**

Write `tests/unit/stores/normalGameStore.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { useNormalGameStore } from '@/stores/normalGameStore';
import { useGameStore } from '@/stores/gameStore';

describe('useNormalGameStore (backward-compat re-export)', () => {
  it('should be the same store as useGameStore', () => {
    expect(useNormalGameStore).toBe(useGameStore);
  });

  it('should share state with useGameStore', () => {
    useGameStore.getState().reset();
    useGameStore.getState().setDailyGame('test-key', {
      region: 'us',
      date: '2025-01-01',
      mode: 'normal',
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4,
    });

    const game = useNormalGameStore.getState().getDailyGame('test-key');
    expect(game).toBeDefined();
    expect(game?.region).toBe('us');
  });
});
```

- [ ] **Step 5: Update Constants.jsx**

In `src/utils/Constants.jsx`, remove the old `GAME_STATE:` key and add the new one:

Change:
```javascript
export const STORAGE_KEYS = {
  REGION: "audio-birdle-region",
  GAME_STATE: "audio-birdle-game-state",
  // ... rest
```
To add (don't remove GAME_STATE yet, it may be referenced elsewhere, just suppress if unused):

```javascript
export const STORAGE_KEYS = {
  REGION: "audio-birdle-region",
  GAME_STATE: "audio-birdle-game-state",
  GAME: "audio-birdle-game",
  // ... rest unchanged
```

- [ ] **Step 6: Update App.jsx to use gameStore**

In `src/App.jsx`:

Change import:
```javascript
import { useNormalGameStore } from "./stores/normalGameStore";
import { useHardModeStore } from "./stores/hardModeStore";
```
To:
```javascript
import { useGameStore } from "./stores/gameStore";
```

Replace lines 48-58 (the dual store selectors):

```javascript
const currentDailyGame = useNormalGameStore((state) =>
    selectedRegion && today
      ? state.getDailyGame(`${selectedRegion}-${today}`)
      : null,
  );

  const hardModeGame = useHardModeStore((state) =>
    selectedRegion && today
      ? state.getHardModeGame(`${selectedRegion}-${today}`)
      : null,
  );

  const normalModeGame = useNormalGameStore((state) =>
    selectedRegion && today
      ? state.getDailyGame(`${selectedRegion}-${today}`)
      : null,
  );
```

With:
```javascript
const currentDailyGame = useGameStore((state) =>
    selectedRegion && today
      ? state.getDailyGame(`${selectedRegion}-${today}-normal`)
      : null,
  );

  const hardModeGame = useGameStore((state) =>
    selectedRegion && today
      ? state.getDailyGame(`${selectedRegion}-${today}-hard`)
      : null,
  );
```

And remove the `normalModeGame` reference entirely — on line 149, `const normalModeCompleted = normalModeGame?.completed === true;` becomes:
```javascript
const normalModeCompleted = currentDailyGame?.completed === true;
```

On line 66, `const stats = useNormalGameStore((state) => state.stats);` becomes:
```javascript
const stats = useGameStore((state) => state.stats);
```

- [ ] **Step 7: Update useDailyGame.js**

In `src/hooks/useDailyGame.js`:

Change imports:
```javascript
import { useNormalGameStore } from "../stores/normalGameStore";
import { useHardModeStore } from "../stores/hardModeStore";
```
To:
```javascript
import { useGameStore } from "../stores/gameStore";
```

Update `getDailyGame`:
```javascript
const getDailyGame = useCallback(() => {
    if (!region) return null;
    return useGameStore.getState().getDailyGame(`${region}-${today}-normal`);
  }, [region, today]);
```

Update `makeGuess`:
```javascript
const makeGuess = useCallback(
    (birdId) => {
      if (!todaysBird || !region) return;
      useGameStore.getState().processGuess(`${region}-${today}-normal`, {
        birdId,
        correct: birdId === todaysBird.id,
        timestamp: Date.now(),
      });
    },
    [region, today, todaysBird],
  );
```

Update `makeHardModeGuess`:
```javascript
const makeHardModeGuess = useCallback(
    (bird) => {
      if (!todaysBird || !region) return;
      const taxonomicScore = compareTaxonomy(bird, todaysBird);
      useGameStore.getState().processGuess(`${region}-${today}-hard`, {
        birdId: bird.id,
        textInput: bird.name,
        correct: bird.id === todaysBird.id,
        timestamp: Date.now(),
        taxonomicScore,
      });
    },
    [region, today, todaysBird],
  );
```

Update `resetTodaysGame`:
```javascript
const resetTodaysGame = useCallback(() => {
    if (!region) return;
    const key = `${region}-${today}-normal`;
    useGameStore.getState().setDailyGame(key, {
      region,
      date: today,
      mode: 'normal',
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4,
    });
  }, [region, today]);
```

Update `resetAllData`:
```javascript
const resetAllData = useCallback(() => {
    useGameStore.getState().reset();
  }, []);
```

Update `getHardModeGame`:
```javascript
const getHardModeGame = useCallback(() => {
    if (!region) return null;
    return useGameStore.getState().getDailyGame(`${region}-${today}-hard`);
  }, [region, today]);
```

- [ ] **Step 8: Update useGameInitialization.js**

In `src/hooks/useGameInitialization.js`:

Change import:
```javascript
import { useNormalGameStore } from "../stores/normalGameStore";
```
To:
```javascript
import { useGameStore } from "../stores/gameStore";
```

Change key and update `maxGuesses` to `mode`:
```javascript
const key = `${selectedRegion}-${today}-normal`;
const existingGame = useGameStore.getState().getDailyGame(key);
if (!existingGame) {
  useGameStore.getState().setDailyGame(key, {
    region: selectedRegion,
    date: today,
    mode: 'normal',
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: 4,
  });
}
```

- [ ] **Step 9: Update GameLogic.jsx imports**

In `src/utils/GameLogic.jsx`:

Change:
```javascript
import { useNormalGameStore } from "../stores/normalGameStore";
import { useHardModeStore } from "../stores/hardModeStore";
```
To:
```javascript
import { useGameStore } from "../stores/gameStore";
```

Update all `useNormalGameStore.getState()` calls to `useGameStore.getState()`.
Update all key constructions from `${region}-${today}` to `${region}-${today}-normal` or `${region}-${today}-hard` depending on context.

Note: The function `createRegionDateKey` (line 17-19) is used by external callers — leave it as-is for now, but internal callers should append `-normal` or `-hard`.

- [ ] **Step 10: Update HardModeGame.jsx**

In `src/utils/HardModeGame.jsx`:

Change import:
```javascript
import { useHardModeStore } from "../stores/hardModeStore";
```
To:
```javascript
import { useGameStore } from "../stores/gameStore";
```

Update all occurrences:
- `useHardModeStore((state) => state.getHardModeGame(key))` → `useGameStore((state) => state.getDailyGame(key))`
- `useHardModeStore.getState().setHardModeGame(key, ...)` → `useGameStore.getState().setDailyGame(key, ...)`
- `useHardModeStore.getState().processHardModeGuess(key, ...)` → `useGameStore.getState().processGuess(key, ...)`

And change key format from `${region}-${today}` to `${region}-${today}-hard`.

- [ ] **Step 11: Run the full test suite**

Run: `npx vitest run --config=vitest.config.js`
Expected: If there are failures, fix them (test key format changes, import path changes, etc.)

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: migrate all consumers to unified gameStore

- Delete hardModeStore.ts and practiceStore.ts
- Replace normalGameStore.ts with backward-compat re-export
- Update App.jsx, useDailyGame, useGameInitialization, GameLogic,
  HardModeGame to use gameStore with region-date-mode keys
- Add GAME key to Constants.jsx STORAGE_KEYS"
```

---

### Task 2.3: Remove useMigration.js hook

**Files:**
- Modify: `src/App.jsx`
- Delete: `src/hooks/useMigration.js`

- [ ] **Step 1: Remove useMigration usage from App.jsx**

In `src/App.jsx`:
- Remove line: `import { useMigration } from "./hooks/useMigration";`
- Remove line: `useMigration();`

- [ ] **Step 2: Delete the file**

Run: `rm src/hooks/useMigration.js`

- [ ] **Step 3: Check for tests referencing useMigration**

Run: `grep -r "useMigration" tests/`
If any test files reference it, update them.

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config=vitest.config.js`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git rm src/hooks/useMigration.js
git add src/App.jsx
git commit -m "refactor: remove useMigration hook

Migration now handled automatically by gameStore on first rehydrate."
```

---

## Phase 3: Unified Game View (Cascade 2)

### Task 3.1: Move HardModeGame.jsx and PracticeGame.jsx to components/

These are React components currently misplaced in `src/utils/`. Moving them to `src/components/` is a preliminary refactor before merging.

**Files:**
- Move: `src/utils/HardModeGame.jsx` → `src/components/HardModeGame.jsx`
- Move: `src/utils/PracticeGame.jsx` → `src/components/PracticeGame.jsx`
- Modify: `src/App.jsx` (import paths)
- Modify: `src/utils/HardModeGame.jsx` (update relative imports)
- Modify: `src/utils/PracticeGame.jsx` (update relative imports)

- [ ] **Step 1: Move files and update internal imports**

Run:
```bash
git mv src/utils/HardModeGame.jsx src/components/HardModeGame.jsx
git mv src/utils/PracticeGame.jsx src/components/PracticeGame.jsx
```

- [ ] **Step 2: Fix relative import paths in HardModeGame.jsx**

After the move, `src/components/HardModeGame.jsx` is now in `components/`. Update its imports:

```javascript
// Change these:
import HardModeInput from "./HardModeInput";
import TaxonomicBadge from "./TaxonomicBadge";
import BirdCompletionCard from "./BirdCompletionCard";
import { createAudioControls, getAudioSrc } from "./AudioUtils";
import { GAME_CONFIG } from "./Constants";
import { extractGenus, compareTaxonomy } from "./TaxonomyUtils";
import { getTodayString } from "./DateUtils";
import { generateHardModeShareText, shareResult } from "./ShareUtils";
import { SubregionDisplay } from "./SubregionUtils";
import { useHardModeStore } from "../stores/hardModeStore";

// To these:
import HardModeInput from "../utils/HardModeInput";
import TaxonomicBadge from "../utils/TaxonomicBadge";
import BirdCompletionCard from "../utils/BirdCompletionCard";
import { createAudioControls, getAudioSrc } from "../utils/AudioUtils";
import { GAME_CONFIG } from "../utils/Constants";
import { extractGenus, compareTaxonomy } from "../utils/TaxonomyUtils";
import { getTodayString } from "../utils/DateUtils";
import { generateHardModeShareText, shareResult } from "../utils/ShareUtils";
import { SubregionDisplay } from "../utils/SubregionUtils";
import { useGameStore } from "../stores/gameStore";
```

- [ ] **Step 3: Fix relative import paths in PracticeGame.jsx**

Similarly update imports in `src/components/PracticeGame.jsx`.

- [ ] **Step 4: Update App.jsx imports**

In `src/App.jsx`:
```javascript
// Change:
import PracticeGame from "./utils/PracticeGame";
import HardModeGame from "./utils/HardModeGame";
// To:
import PracticeGame from "./components/PracticeGame";
import HardModeGame from "./components/HardModeGame";
```

- [ ] **Step 5: Run tests and lint**

Run:
```bash
npx vitest run --config=vitest.config.js
npx eslint src/
```
Expected: All pass (or fix any import issues).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move HardModeGame and PracticeGame from utils/ to components/

These are React components with JSX rendering, not utility functions.
Moving them to the correct directory before further refactoring."
```

---

### Task 3.2: Create unified GameView component

**Files:**
- Create: `src/components/GameView.jsx` (rewrite existing file)
- Delete: `src/components/HardModeGame.jsx`
- Delete: `src/components/PracticeGame.jsx`
- Modify: `src/App.jsx`

This is the largest single refactor. The new `GameView` accepts a `mode` prop and handles all three game modes.

- [ ] **Step 1: Write the unified GameView.jsx**

This is a full rewrite of `src/components/GameView.jsx`. It combines GameView, HardModeGame, and PracticeGame into one component:

```jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Settings,
  Volume2,
  RefreshCw,
  Target,
  Play,
  Pause,
  ArrowLeft,
  RotateCcw,
  ArrowRight,
  Share2,
} from "lucide-react";
import HardModeInput from "../utils/HardModeInput";
import TaxonomicBadge from "../utils/TaxonomicBadge";
import BirdCompletionCard from "../utils/BirdCompletionCard";
import SubregionDisplay from "../utils/SubregionUtils";
import CountdownToMidnight from "../utils/CountdownToMidnight";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { getAudioSrc } from "../utils/AudioUtils";
import { formatDateForDisplay } from "../utils/DateUtils";
import { GAME_CONFIG } from "../utils/Constants";
import { extractGenus, compareTaxonomy } from "../utils/TaxonomyUtils";
import { useGameStore } from "../stores/gameStore";
import { generateAnswerOptions } from "../utils/GameLogic";
import {
  createInitialPracticeState,
  getPracticeBird,
  generatePracticeAnswerOptions,
  processPracticeGuess,
  processHardPracticeGuess,
  startNewPracticeRound,
} from "../utils/PracticeGameLogic";
import {
  generateShareText,
  generateHardModeShareText,
  shareResult,
} from "../utils/ShareUtils";

/**
 * Unified game view for normal, hard, and practice modes.
 *
 * @param {'normal'|'hard'} mode - Game mode
 * @param {boolean} isPractice - Whether this is practice mode (no persistence)
 */
export default function GameView({
  mode = 'normal',
  isPractice = false,
  region,
  today,
  regions,
  todaysBird,
  birds,
  onBack,
  onNavigateSettings,
  onNavigatePractice,
  onNavigateHard,
  dataConsistencyError,
  hasUpdate,
  refreshingData,
  handleForceRefresh,
  normalModeCompleted = false,
}) {
  const audioPlayer = useAudioPlayer();
  const {
    isPlaying,
    audioError,
    setAudioError,
    audioRef,
    selectedAudioIndex,
    setSelectedAudioIndex,
    toggleAudio,
    handleAudioError,
  } = audioPlayer;

  // ---- Daily game state (from store) ----
  const dailyKey = region && today ? `${region}-${today}-${mode}` : null;
  const dailyGame = useGameStore((state) =>
    dailyKey ? state.getDailyGame(dailyKey) : null,
  );

  // Initialize daily game in store if not exists
  const store = useGameStore.getState();
  if (region && today && dailyKey && !store.getDailyGame(dailyKey) && !isPractice) {
    store.setDailyGame(dailyKey, {
      region,
      date: today,
      mode,
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: mode === 'hard' ? GAME_CONFIG.HARD_MODE_MAX_GUESSES : GAME_CONFIG.MAX_GUESSES,
    });
  }

  // ---- Practice game state (local useState) ----
  const [practiceState, setPracticeState] = useState(null);
  const [isHardPractice, setIsHardPractice] = useState(false);

  // Initialize practice on mount / mode change
  useEffect(() => {
    if (isPractice && region && birds[region]) {
      const initialState = createInitialPracticeState(region, isHardPractice);
      const firstBird = getPracticeBird(region, birds, 0);
      if (firstBird) {
        let answerOptions = [];
        if (!isHardPractice) {
          answerOptions = generatePracticeAnswerOptions(region, birds, 0, firstBird);
        }
        setPracticeState({
          ...initialState,
          currentBird: firstBird,
          answerOptions,
        });
      }
    }
  }, [region, birds, isHardPractice, isPractice]);

  // Reset audio when bird changes
  useEffect(() => {
    audioPlayer.setSelectedAudioIndex(0);
    setAudioError(false);
  }, [todaysBird, practiceState?.currentBird]);

  // ---- Active game data ----
  const activeGame = isPractice ? practiceState : dailyGame;
  const currentBird = isPractice ? practiceState?.currentBird : todaysBird;
  const guesses = activeGame?.guesses || [];
  const completed = activeGame?.completed || false;
  const won = activeGame?.won || false;
  const maxGuesses = activeGame?.maxGuesses || (mode === 'hard' ? 6 : 4);
  const isHardMode = mode === 'hard' || isHardPractice;
  const remainingGuesses = maxGuesses - guesses.length;

  // Answer options (daily normal mode)
  const answerOptions = isPractice
    ? practiceState?.answerOptions || []
    : (mode === 'normal' && todaysBird
        ? generateAnswerOptions(region, birds, today, todaysBird, GAME_CONFIG.ANSWER_OPTIONS_COUNT)
        : []);

  // ---- Actions ----
  const makeGuess = useCallback((birdId) => {
    if (isPractice) {
      if (!practiceState || !practiceState.currentBird) return;
      const newState = processPracticeGuess(practiceState, birdId);
      setPracticeState(newState);
    } else {
      if (!todaysBird || !region) return;
      useGameStore.getState().processGuess(dailyKey, {
        birdId,
        correct: birdId === todaysBird.id,
        timestamp: Date.now(),
      });
    }
  }, [isPractice, practiceState, todaysBird, region, dailyKey]);

  const makeHardModeGuess = useCallback((bird) => {
    if (isPractice) {
      if (!practiceState || !practiceState.currentBird) return;
      const newState = processHardPracticeGuess(practiceState, bird.name, birds[region]);
      setPracticeState(newState);
    } else {
      if (!todaysBird || !region) return;
      const taxonomicScore = compareTaxonomy(bird, todaysBird);
      useGameStore.getState().processGuess(dailyKey, {
        birdId: bird.id,
        textInput: bird.name,
        correct: bird.id === todaysBird.id,
        timestamp: Date.now(),
        taxonomicScore,
      });
    }
  }, [isPractice, practiceState, todaysBird, region, dailyKey, birds]);

  const startNextRound = useCallback(() => {
    if (!practiceState) return;
    const newState = startNewPracticeRound(practiceState, birds);
    setPracticeState(newState);
  }, [practiceState, birds]);

  const restartCurrentRound = useCallback(() => {
    if (!practiceState || !practiceState.currentBird) return;
    let answerOptions = [];
    if (!practiceState.isHardMode) {
      answerOptions = generatePracticeAnswerOptions(
        practiceState.region, birds, practiceState.practiceIndex, practiceState.currentBird,
      );
    }
    setPracticeState({
      ...practiceState,
      guesses: [],
      completed: false,
      won: false,
      answerOptions,
      startTime: new Date().toISOString(),
      endTime: null,
    });
  }, [practiceState, birds]);

  // ---- Share ----
  const handleShare = useCallback(async () => {
    if (!activeGame || !currentBird) return;
    if (isHardMode) {
      const text = generateHardModeShareText(activeGame, window.location.href);
      await shareResult(text);
    } else {
      const text = generateShareText(activeGame, region, currentBird, window.location.href);
      await shareResult(text);
    }
  }, [activeGame, currentBird, isHardMode, region]);

  // ---- Memoized guess display data (for hard mode taxonomic display) ----
  const guessDisplayData = useMemo(() => {
    if (!isHardMode || !birds?.[region]) return [];
    return guesses.map((guess) => {
      const guessedBird = guess.birdId ? birds[region].find(b => b.id === guess.birdId) : null;
      return {
        guess,
        guessedBird,
        genus: guessedBird ? extractGenus(guessedBird.scientificName) : null,
      };
    });
  }, [isHardMode, guesses, birds, region]);

  // ---- Color themes ----
  const theme = isPractice
    ? (isHardPractice ? 'red' : 'purple')
    : (mode === 'hard' ? 'red' : 'blue');

  const bgGradient = {
    blue: 'from-blue-50 to-green-50',
    red: 'from-red-50 to-orange-50',
    purple: 'from-purple-50 to-pink-50',
  }[theme];

  const accentColor = {
    blue: 'blue',
    red: 'red',
    purple: 'purple',
  }[theme];

  // ---- Loading state ----
  if (!currentBird && !isPractice) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bgGradient}`}>
        <div className="max-w-md mx-auto px-4 py-6">
          <button onClick={onBack} className="text-gray-600 hover:text-gray-800 mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <p className="text-gray-600">Loading today's bird...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentBird && isPractice) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bgGradient} p-4`}>
        <div className="max-w-md mx-auto pt-8">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={onBack} className={`text-${accentColor}-500 hover:text-${accentColor}-600`}>
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {isHardPractice ? '🔥 Hard Practice' : '🎯 Practice Mode'}
            </h1>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <p>Loading practice session...</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradient} p-4`}>
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">
              {isPractice
                ? (isHardPractice ? '🔥 Hard Practice' : '🎯 Practice Mode')
                : (mode === 'hard' ? '🔥 Hard Mode' : '🐦 Audio-Birdle')}
            </h1>
            {hasUpdate && (
              <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                Update Available
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mode switching buttons (daily only) */}
            {!isPractice && mode === 'normal' && (
              <>
                <button
                  onClick={onNavigateHard}
                  disabled={completed || normalModeCompleted}
                  className={`${
                    completed || normalModeCompleted ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                  } text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm`}
                >
                  <Target className="w-4 h-4" /> Hard Mode
                </button>
                <button
                  onClick={onNavigatePractice}
                  className="bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
                >
                  <Target className="w-4 h-4" /> Practice
                </button>
              </>
            )}
            {/* Practice mode toggle */}
            {isPractice && (
              <button
                onClick={() => setIsHardPractice(p => !p)}
                className={`${
                  isHardPractice ? "bg-red-500 hover:bg-red-600" : "bg-purple-500 hover:bg-purple-600"
                } text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm`}
              >
                <Target className="w-4 h-4" />
                {isHardPractice ? 'Normal' : 'Hard'}
              </button>
            )}
            <button
              onClick={onBack}
              className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
            >
              Change Mode
            </button>
            {!isPractice && (
              <button
                onClick={onNavigateSettings}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Game Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          {/* Data consistency error */}
          {dataConsistencyError && !todaysBird && !isPractice && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-6 mb-4">
              <div className="text-center">
                <p className="text-red-800 font-medium mb-2">⚠️ Data Sync Issue</p>
                <p className="text-sm text-red-700 mb-4">{dataConsistencyError}</p>
                <div className="flex flex-col gap-2 items-center">
                  <button onClick={handleForceRefresh} disabled={refreshingData}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-gray-400">
                    <RefreshCw className={`w-4 h-4 ${refreshingData ? "animate-spin" : ""}`} />
                    {refreshingData ? "Refreshing..." : "Force Refresh Data"}
                  </button>
                  <button onClick={() => window.location.reload()}
                    className="text-red-600 underline text-sm hover:text-red-800">
                    Or reload the page
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Normal mode completed warning (hard mode only) */}
          {!isPractice && mode === 'hard' && normalModeCompleted && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 text-center">
                ⚠️ You've already completed Normal Mode today. You can't play Hard Mode on the same day.
              </p>
            </div>
          )}

          {/* Region / date info */}
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-2">
              {regions.find((r) => r.id === region)?.name}
            </p>
            <p className="text-sm text-gray-500">
              {isPractice
                ? `Practice Round #${(practiceState?.practiceIndex || 0) + 1}`
                : `Daily Bird Challenge • ${formatDateForDisplay(today)}`}
            </p>
          </div>

          {/* Audio Player */}
          <div className="mb-6">
            <div className={`${accentColor === 'blue' ? 'bg-blue-50' : accentColor === 'red' ? 'bg-red-50' : 'bg-purple-50'} rounded-lg p-6 text-center`}>
              <Volume2 className={`w-12 h-12 mx-auto mb-4 text-gray-400`} />

              {/* Multi-recording selector */}
              {currentBird && Array.isArray(currentBird.audioUrl) && currentBird.audioUrl.length > 1 && (
                <div className="mb-4">
                  <select
                    value={selectedAudioIndex}
                    onChange={(e) => {
                      const newIndex = parseInt(e.target.value);
                      setSelectedAudioIndex(newIndex);
                      if (audioRef.current) audioRef.current.load();
                    }}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {currentBird.audioUrl.map((_, index) => (
                      <option key={index} value={index}>Recording {index + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              <audio
                ref={audioRef}
                src={currentBird ? getAudioSrc(currentBird.audioUrl, selectedAudioIndex) : ''}
                onEnded={() => {}}
                onError={handleAudioError}
                onLoadStart={() => setAudioError(false)}
                preload="none"
                key={`${currentBird?.id || 'bird'}-${selectedAudioIndex}`}
              />

              <button
                onClick={toggleAudio}
                disabled={!currentBird || audioError}
                className={`bg-${accentColor}-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto hover:bg-${accentColor}-600 transition-colors disabled:bg-gray-300`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isPlaying ? "Pause" : "Play"} Bird Call
              </button>

              {audioError && (
                <p className="text-red-500 text-sm mt-2">
                  Audio {isPractice ? "failed to load - try selecting a different recording" : "did not load - please try reloading the page"}
                </p>
              )}
            </div>
          </div>

          {/* Location Hint */}
          {!isHardMode && (
            <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
              <p className="text-sm text-gray-700">
                💡 This bird was observed in the last 14 days on eBird in{" "}
                <span className="font-semibold text-blue-700">
                  <SubregionDisplay selectedRegion={region} today={today} />
                </span>
              </p>
            </div>
          )}

          {/* Game Status */}
          {(isHardMode || isPractice) && (
            <div className="text-center mb-4 text-gray-600">
              {completed
                ? (won ? "🎉 Correct!" : "😔 Game Over")
                : `${remainingGuesses} ${remainingGuesses === 1 ? 'guess' : 'guesses'} remaining`}
            </div>
          )}

          {/* Guess History */}
          {guesses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Your Guesses:</h3>
              <div className="space-y-2">
                {isHardMode
                  ? guessDisplayData.map(({ guess, guessedBird, genus }) => (
                      <div key={`${guess.birdId}-${guess.timestamp}`}
                        className="bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">{guess.textInput}</div>
                            {guessedBird && (
                              <div className="text-sm text-gray-500 italic">{guessedBird.scientificName}</div>
                            )}
                          </div>
                          <div className="text-2xl">{guess.correct ? "✅" : "❌"}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <TaxonomicBadge label="Order" correct={guess.taxonomicScore?.order} show={true} value={guessedBird?.order} />
                          <TaxonomicBadge label="Family" correct={guess.taxonomicScore?.family} show={true} value={guessedBird?.family} />
                          <TaxonomicBadge label="Genus" correct={guess.taxonomicScore?.genus} show={true} value={genus} />
                          <TaxonomicBadge label="Species" correct={guess.taxonomicScore?.species} show={true} />
                        </div>
                      </div>
                    ))
                  : guesses.map((guess, index) => {
                      const guessedBird = (isPractice ? practiceState?.answerOptions : answerOptions).find(b => b.id === guess.birdId);
                      return (
                        <div key={index}
                          className={`p-3 rounded-lg border-2 ${guess.correct ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
                          <div className="flex items-center justify-between">
                            <span>{guessedBird?.name}</span>
                            <span className="text-2xl">{guess.correct ? "✅" : "❌"}</span>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}

          {/* Progressive Hints (Hard Mode) */}
          {!completed && isHardMode && guesses.length >= 1 && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 mb-4">
              <h4 className="font-semibold text-yellow-800 mb-2">🔍 Taxonomic Hints:</h4>
              {guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER && (
                <div className="text-sm"><span className="font-medium">Order:</span> {currentBird.order}</div>
              )}
              {guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY && (
                <div className="text-sm mt-1"><span className="font-medium">Family:</span> {currentBird.family}</div>
              )}
              {guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS && (
                <div className="text-sm mt-1"><span className="font-medium">Genus:</span> {extractGenus(currentBird.scientificName)}</div>
              )}
            </div>
          )}

          {/* Input Area */}
          {!completed && (
            <>
              {isHardMode ? (
                <HardModeInput
                  birds={birds[region]}
                  onGuess={makeHardModeGuess}
                  placeholder="Type bird name or scientific name..."
                />
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold mb-2">
                    Choose the bird ({guesses.length + 1}/{maxGuesses}):
                  </h3>
                  {answerOptions.map((bird) => (
                    <button
                      key={bird.id}
                      onClick={() => makeGuess(bird.id)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium">{bird.name}</div>
                      <div className="text-sm text-gray-500 italic">{bird.scientificName}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Completion */}
          {completed && (
            <div className="text-center">
              <div className={`text-2xl font-bold mb-4 ${won ? "text-green-600" : "text-red-600"}`}>
                {isPractice
                  ? (won ? "🎉 Correct!" : "😔 Not quite!")
                  : (won ? "🎉 Well done!" : "😔 Better luck tomorrow!")}
              </div>

              <BirdCompletionCard
                bird={currentBird}
                selectedAudioIndex={selectedAudioIndex}
                onShare={!isPractice ? handleShare : undefined}
                variant={isHardMode ? "hard" : (isPractice ? "practice" : "normal")}
              />

              {/* Practice mode actions */}
              {isPractice && (
                <div className="flex gap-2 mt-4">
                  <button onClick={restartCurrentRound}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </button>
                  <button onClick={startNextRound}
                    className={`flex-1 ${isHardPractice ? "bg-red-500 hover:bg-red-600" : "bg-purple-500 hover:bg-purple-600"} text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}>
                    Next Bird <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isPractice && (
          <div className="text-center text-sm text-gray-500">
            Next bird in: <CountdownToMidnight />
          </div>
        )}
        {isPractice && (
          <div className="text-center text-sm text-gray-500">
            <p>Practice Mode • Stats not saved</p>
            <p>Keep practicing to improve your bird identification skills!</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: The above uses Tailwind dynamic classes (`bg-${accentColor}-500`) which won't work with Tailwind's JIT compiler. You MUST replace the dynamic color classes with a lookup object. See step 2.

- [ ] **Step 2: Fix Tailwind dynamic classes**

Tailwind JIT doesn't support dynamically constructed class names. Add a color class map at the top of the component:

```javascript
const colorMap = {
  blue: {
    bg50: 'bg-blue-50',
    text500: 'text-blue-500',
    hover600: 'hover:bg-blue-600',
    bg500: 'bg-blue-500',
  },
  red: {
    bg50: 'bg-red-50',
    text500: 'text-red-500',
    hover600: 'hover:bg-red-600',
    bg500: 'bg-red-500',
  },
  purple: {
    bg50: 'bg-purple-50',
    text500: 'text-purple-500',
    hover600: 'hover:bg-purple-600',
    bg500: 'bg-purple-500',
  },
};
```

Then use `colorMap[theme].bg500` instead of `` `bg-${accentColor}-500` ``.

- [ ] **Step 3: Update App.jsx to use unified GameView**

In `src/App.jsx`, replace the normal mode render (lines 193-228) and the hard mode render (lines 148-163) with:

```jsx
// Normal mode
if (currentView === VIEWS.GAME) {
  return (
    <GameView
      mode="normal"
      isPractice={false}
      region={selectedRegion}
      today={today}
      regions={regions}
      todaysBird={todaysBird}
      birds={birds}
      onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      onNavigateSettings={() => setCurrentView(VIEWS.SETTINGS)}
      onNavigatePractice={() => setCurrentView(VIEWS.PRACTICE)}
      onNavigateHard={() => setCurrentView(VIEWS.HARD_MODE)}
      dataConsistencyError={dataConsistencyError}
      hasUpdate={hasUpdate}
      refreshingData={refreshingData}
      handleForceRefresh={handleForceRefresh}
      hardModeCompleted={hardModeGame?.completed === true}
    />
  );
}

// Hard mode
if (currentView === VIEWS.HARD_MODE) {
  return (
    <GameView
      mode="hard"
      isPractice={false}
      region={selectedRegion}
      today={today}
      regions={regions}
      todaysBird={todaysBird}
      birds={birds}
      onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      onNavigateSettings={() => setCurrentView(VIEWS.SETTINGS)}
      dataConsistencyError={dataConsistencyError}
      hasUpdate={hasUpdate}
      refreshingData={refreshingData}
      handleForceRefresh={handleForceRefresh}
      normalModeCompleted={currentDailyGame?.completed === true}
    />
  );
}

// Practice mode
if (currentView === VIEWS.PRACTICE) {
  return (
    <GameView
      mode="normal"
      isPractice={true}
      region={selectedRegion}
      today={today}
      regions={regions}
      todaysBird={null}
      birds={birds}
      onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
    />
  );
}
```

- [ ] **Step 4: Remove old HardModeGame and PracticeGame imports from App.jsx**

Remove:
```javascript
import PracticeGame from "./components/PracticeGame";
import HardModeGame from "./components/HardModeGame";
```

- [ ] **Step 5: Remove the back button handler for settings and mode switching from App's old GameView render**

The unified GameView now handles navigation internally via the callback props.

- [ ] **Step 6: Delete old files**

Run:
```bash
rm src/components/HardModeGame.jsx
rm src/components/PracticeGame.jsx
```

- [ ] **Step 7: Update Constants.jsx VIEWS**

The VIEWS object can be simplified since there's no longer separate HARD_MODE and PRACTICE views (they're just parameters to GameView):
```javascript
export const VIEWS = {
  GAME: "game",
  PRACTICE: "practice",
  HARD_MODE: "hard-mode",
  SETTINGS: "settings",
  MODE_SELECTOR: "mode-selector",
  STATS: "stats",
};
```

(Keep HARD_MODE and PRACTICE so App.jsx routing still works — they just all render the same component with different props.)

- [ ] **Step 8: Run full test suite and lint**

Run:
```bash
npx vitest run --config=vitest.config.js
npx eslint src/
```

Expected: Tests that rely on specific import paths or component names may fail. Fix them one by one.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: create unified GameView component

Single GameView handles normal, hard, and practice modes via props.
Eliminates HardModeGame.jsx (377 lines) and PracticeGame.jsx (492 lines).
Audio player uses useAudioPlayer hook consistently.
Input/feedback rendered conditionally based on isHardMode flag."
```

---

## Phase 4: Cleanup (Cascade 4)

### Task 4.1: Remove backward-compat code from GameLogic.jsx

**Files:**
- Modify: `src/utils/GameLogic.jsx`
- Modify: `tests/unit/utils/GameLogic.test.jsx`

- [ ] **Step 1: Remove backward-compat functions from GameLogic.jsx**

Remove these functions (they're no longer needed after store unification):
- `migrateGameState` (lines 71-126)
- `ensureGameStateFormat` (lines 133-146)  
- `needsMigration` (lines 53-64)
- `updateUserStats` (if present — the exploration noted it's "not actively used")
- `createInitialGameState` (lines 25-46 — was the old non-store initial state)

Note: Check that `createInitialGameState` and `ensureGameStateFormat` are only used in tests. If they are, remove from both source and tests.

- [ ] **Step 2: Remove `gameState` parameter backward compat from exported functions**

Functions like `processGuess(gameState, ...)` that take `gameState` as first parameter but delegate to Zustand internally should lose that parameter. Update all callers (mainly tests).

Check each exported function in GameLogic.jsx for the `gameState` parameter pattern. For functions that only serve the store path now, remove the backward-compat `gameState` parameter.

- [ ] **Step 3: Run tests to identify breakage**

Run: `npx vitest run --config=vitest.config.js tests/unit/utils/GameLogic.test.jsx`
Expected: Some tests will fail because they call the removed functions. Update tests to use store APIs directly.

- [ ] **Step 4: Update GameLogic.test.jsx**

Remove test describe blocks for deleted functions:
- `describe('migrateGameState', ...)`
- `describe('ensureGameStateFormat', ...)`
- `describe('needsMigration', ...)`

Update any tests that call functions with the old `gameState` parameter signature.

- [ ] **Step 5: Commit**

```bash
git add src/utils/GameLogic.jsx tests/unit/utils/GameLogic.test.jsx
git commit -m "refactor: remove backward-compat code from GameLogic.jsx

Delete migrateGameState, ensureGameStateFormat, needsMigration,
createInitialGameState. Remove gameState parameter backward compat
from functions that delegate to Zustand stores."
```

---

### Task 4.2: Inline useGameNavigation.js

**Files:**
- Modify: `src/App.jsx`
- Delete: `src/hooks/useGameNavigation.js`
- Modify: `tests/unit/hooks/useGameNavigation.test.jsx` (if exists)

- [ ] **Step 1: Inline into App.jsx**

In `src/App.jsx`, remove:
```javascript
import { useGameNavigation } from "./hooks/useGameNavigation";
```

And replace:
```javascript
const { currentView, setCurrentView } = useGameNavigation();
```
With:
```javascript
const [currentView, setCurrentView] = useState(VIEWS.MODE_SELECTOR);
```

Make sure `useState` is imported from `react` in App.jsx.

- [ ] **Step 2: Delete useGameNavigation.js**

Run:
```bash
rm src/hooks/useGameNavigation.js
```

- [ ] **Step 3: Commit**

```bash
git rm src/hooks/useGameNavigation.js
git add src/App.jsx
git commit -m "refactor: inline useGameNavigation hook

The hook was a trivial 2-line useState wrapper. Inlined into App.jsx."
```

---

### Task 4.3: Inline useGameInitialization.js

**Files:**
- Modify: `src/App.jsx`
- Delete: `src/hooks/useGameInitialization.js`
- Modify: `tests/unit/hooks/useGameInitialization.test.jsx` (if exists)

- [ ] **Step 1: Inline initialization into App.jsx or GameView**

Since the new unified GameView already initializes the game in its component body (see the `if (region && today && dailyKey && !store.getDailyGame(dailyKey) && !isPractice)` block in Task 3.2), the `useGameInitialization` hook is no longer needed. Simply remove its import and usage from App.jsx.

Remove:
```javascript
import { useGameInitialization } from "./hooks/useGameInitialization";
```
And:
```javascript
useGameInitialization(selectedRegion, today, currentDailyGame);
```

- [ ] **Step 2: Delete useGameInitialization.js**

Run:
```bash
rm src/hooks/useGameInitialization.js
```

- [ ] **Step 3: Commit**

```bash
git rm src/hooks/useGameInitialization.js
git add src/App.jsx
git commit -m "refactor: remove useGameInitialization hook

Game initialization is now handled directly in GameView component."
```

---

### Task 4.4: Remove duplicate bird-loading block in useGameData.js

**Files:**
- Modify: `src/hooks/useGameData.js`

- [ ] **Step 1: Extract shared bird-loading helper**

In `src/hooks/useGameData.js`, the same 12-line block that loads today's bird appears in `handleAutoRefresh` (lines 89-99), `handleForceRefresh` (lines 136-147), and `handleRefreshData` (lines 169-179). Extract it:

```javascript
// Add this helper before the hook function:
const loadAndSetBird = async (initialRegion, newBirds, today, setTodaysBird, setDataConsistencyError, setLoadingBird) => {
  if (!initialRegion || !newBirds[initialRegion]) return;
  
  setLoadingBird(true);
  const result = await getDailyBirdWithFallback(initialRegion, newBirds[initialRegion], today);
  if (result.success && result.bird) {
    setTodaysBird(result.bird);
    setDataConsistencyError(null);
  } else {
    setTodaysBird(null);
    setDataConsistencyError(result.message);
  }
  setLoadingBird(false);
};
```

- [ ] **Step 2: Replace all three duplicate blocks with the helper**

In `handleAutoRefresh`:
```javascript
// Replace lines 89-99 with:
await loadAndSetBird(initialRegion, newBirds, today, setTodaysBird, setDataConsistencyError, setLoadingBird);
```

In `handleForceRefresh`:
```javascript
// Replace lines 136-147 with:
await loadAndSetBird(initialRegion, newBirds, today, setTodaysBird, setDataConsistencyError, setLoadingBird);
```

In `handleRefreshData`:
```javascript
// Replace lines 169-179 with:
await loadAndSetBird(initialRegion, newBirds, today, setTodaysBird, setDataConsistencyError, setLoadingBird);
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run --config=vitest.config.js tests/unit/hooks/useGameData.test.jsx`
Expected: All pass (the logic is identical).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGameData.js
git commit -m "refactor: extract duplicate bird-loading block in useGameData

handleAutoRefresh, handleForceRefresh, and handleRefreshData all
contained identical bird-loading logic. Extracted to loadAndSetBird helper."
```

---

## Phase 5: Verification

### Task 5.1: Full test suite and lint

**Files:**
- All modified files

- [ ] **Step 1: Run the full JavaScript test suite**

Run: `npx vitest run --config=vitest.config.js`
Expected: All tests pass. Fix any failures.

- [ ] **Step 2: Run ESLint**

Run: `npx eslint src/`
Expected: No errors. Fix any warnings.

- [ ] **Step 3: Typecheck (if tsconfig is set up)**

Run: `npx tsc --noEmit`
Expected: No type errors in TypeScript files (gameStore.ts).

- [ ] **Step 4: Python tests (should be unaffected by JS changes)**

Run: `pytest tests/ -v`
Expected: All pass.

- [ ] **Step 5: Run the dev server and smoke test**

Run: `npm run dev`
- Verify region selector loads
- Verify normal mode plays audio, accepts guesses
- Verify hard mode shows autocomplete, taxonomic hints
- Verify practice mode allows unlimited rounds
- Verify stats view shows correct data
- Verify settings allow refresh and reset
- Verify mode switching works

- [ ] **Step 6: Commit final verification fixes**

```bash
git add -A
git commit -m "chore: final test and lint fixes after simplification cascade"
```

---

## Rollback Plan

If the unified GameView proves too complex, fall back to keeping the three separate components but having them all use:
1. The unified `gameStore` (for daily modes)
2. The `useAudioPlayer` hook (for audio)

The intermediate state after Phase 2 (unified store, separate views) is fully functional and a valid checkpoint.

## Summary of Deletions

| File | Lines | Reason |
|------|-------|--------|
| `src/stores/hardModeStore.ts` | 373 | Merged into gameStore.ts |
| `src/stores/practiceStore.ts` | 60 | Unused |
| `src/utils/HardModeGame.jsx` | 377 | Merged into GameView.jsx |
| `src/utils/PracticeGame.jsx` | 492 | Merged into GameView.jsx |
| `src/hooks/useMigration.js` | 19 | Obsolete (store handles migration) |
| `src/hooks/useGameNavigation.js` | 14 | Trivial — inlined |
| `src/hooks/useGameInitialization.js` | 23 | Inlined into GameView |
| `tests/unit/stores/hardModeStore.test.ts` | 650 | Merged into gameStore.test.ts |
| **Total deleted** | **~2008 lines** | |
