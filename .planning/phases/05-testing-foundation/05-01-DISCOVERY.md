# Phase 5 Plan 01: Integration Testing Discovery

**Created:** 2026-01-16
**Phase:** 05-Testing-Foundation
**Plan:** 01

## Executive Summary

This document establishes integration testing patterns for the Audio-Birdle codebase. Research focused on Vitest integration testing capabilities, existing test patterns in the codebase, and best practices for testing module interactions without full browser environment.

**Key Findings:**
- Vitest provides excellent integration testing support with jsdom environment
- Existing integration tests follow good patterns but lack comprehensive coverage
- Fixture strategy needed for common test scenarios (game states, bird data)
- Mocking strategy should balance between real implementations and controlled boundaries
- Coverage gaps exist in critical error scenarios and cross-module workflows

## 1. Test Organization

### Current Structure

The codebase already follows a clear separation:

```
tests/
├── unit/              # Unit tests for individual utilities
│   ├── utils/        # Utility module tests (GameLogic, DailyBirdUtils, etc.)
│   ├── hooks/        # Custom hook tests
│   ├── stores/       # Zustand store tests
│   └── components/   # Component tests
├── integration/       # Integration tests (module interactions)
│   ├── game-flow.test.jsx
│   ├── hash-consistency.test.js
│   └── test_data_pipeline_integration.py
└── fixtures/         # Shared test data
    └── sampleBirds.js
```

### Recommended Integration Test Organization

**By Feature (Preferred):**
```
tests/integration/
├── game-flow/               # Complete game workflows
│   ├── daily-game.test.jsx
│   ├── hard-mode-game.test.jsx
│   └── practice-game.test.jsx
├── data-loading/            # Data loading and caching
│   ├── load-game-data.test.jsx
│   └── cache-validation.test.jsx
├── state-management/        # Store and persistence
│   ├── zustand-stores.test.jsx
│   └── storage-persistence.test.jsx
├── error-scenarios/         # Error handling and recovery
│   ├── network-failures.test.jsx
│   └── storage-errors.test.jsx
└── cross-language/          # Python/JS consistency
    └── hash-consistency.test.js
```

**By Module (Alternative):**
```
tests/integration/
├── game-logic-integration.test.jsx
├── daily-bird-integration.test.jsx
├── audio-playback-integration.test.jsx
└── store-integration.test.jsx
```

**Recommendation:** Use feature-based organization for better test discoverability and logical grouping of related workflows.

### File Naming Conventions

- Integration tests: `*.integration.test.jsx` or place in `tests/integration/`
- Clear, descriptive names: `daily-game-flow.test.jsx` vs `test1.jsx`
- Test suite names should describe the feature being tested

## 2. Fixture Patterns

### Using Vitest `test.extend()` for Reusable Fixtures

```javascript
import { test as base } from 'vitest'
import { getStorage, setStorage, removeStorage } from '@/utils/StorageUtils'

// Create custom test context with fixtures
const test = base.extend({
  // Clear localStorage before each test
  clearStorage: async ({}, use) => {
    const keys = Object.keys(localStorage)
    keys.forEach(key => removeStorage(key))
    await use()
  },

  // Create test game state
  gameState: async ({}, use) => {
    const state = createTestGameState()
    await use(state)
  },

  // Create test bird data
  testBird: async ({}, use) => {
    const bird = createTestBird()
    await use(bird)
  }
})

test.use(clearStorage)

test('should load and save game state', async ({ gameState, testBird }) => {
  // Test using fixtures
  gameState.dailyGames['us-2025-01-16'] = {
    region: 'us',
    date: '2025-01-16',
    guesses: [],
    completed: false,
    won: false
  }

  setStorage('audio-birdle-game-state', gameState)
  const loaded = getStorage('audio-birdle-game-state')

  expect(loaded).toEqual(gameState)
})
```

### Factory Functions for Test Data

```javascript
// Game State Factory
function createTestGameState(overrides = {}) {
  return {
    version: 2,
    dailyGames: {},
    hardModeGames: {},
    stats: {
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      averageGuesses: 0,
      regionStats: {}
    },
    lastPlayed: null,
    ...overrides
  }
}

// Bird Data Factory
function createTestBird(overrides = {}) {
  return {
    id: 'testbird',
    name: 'Test Bird',
    scientificName: 'Testus birdus',
    order: 'Passeriformes',
    family: 'Testidae',
    audioUrl: ['http://example.com/audio.mp3'],
    ...overrides
  }
}

// Region Data Factory
function createTestRegion(overrides = {}) {
  return {
    code: 'test',
    name: 'Test Region',
    subregions: ['test-sub-1', 'test-sub-2'],
    ...overrides
  }
}

// Daily Entry Factory
function createDailyEntry(overrides = {}) {
  return {
    date: '2025-01-16',
    region: 'us',
    answerHash: 'a1b2c3d4',
    ...overrides
  }
}

// Completed Game Factory
function createCompletedGame(won = true, guesses = 1, overrides = {}) {
  return {
    region: 'us',
    date: '2025-01-16',
    guesses: Array.from({ length: guesses }, (_, i) => ({
      birdId: won && i === guesses - 1 ? 'correct' : `wrong-${i}`,
      correct: won && i === guesses - 1,
      timestamp: Date.now() - (guesses - i) * 1000
    })),
    completed: true,
    won,
    maxGuesses: 4,
    ...overrides
  }
}
```

### Setup/Teardown Patterns

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Game Flow Integration', () => {
  let mockLocalStorage

  beforeEach(() => {
    // Setup: Create fresh mock localStorage
    mockLocalStorage = {
      storage: {},
      getItem(key) {
        return this.storage[key] || null
      },
      setItem(key, value) {
        this.storage[key] = value
      },
      removeItem(key) {
        delete this.storage[key]
      },
      clear() {
        this.storage = {}
      }
    }

    // Stub browser APIs
    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('Audio', vi.fn(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn()
    })))

    // Stub fetch for data loading tests
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    // Cleanup: Remove mocks
    vi.unstubAllGlobals()
    mockLocalStorage.clear()
  })

  it('should process complete game flow', async () => {
    // Test using setup mocks
    const gameState = createTestGameState()
    setStorage('audio-birdle-game-state', gameState)

    // Perform game actions
    // ... test logic

    // Verify state persisted
    const persisted = getStorage('audio-birdle-game-state')
    expect(persisted).toBeDefined()
  })
})
```

## 3. Mocking Strategy

### When to Mock vs Real Implementations

**Mock When:**
- External dependencies (fetch API, browser localStorage, Audio API)
- Network operations (eBird API calls, JSON file downloads)
- Browser APIs (matchMedia, service workers)
- Time-dependent operations (Date.now, setTimeout)
- File system operations (for Python tests)

**Use Real Implementations When:**
- Business logic functions (GameLogic, TaxonomyUtils, etc.)
- Data transformation utilities
- State management logic (Zustand stores)
- Hash functions (HashUtils)

### Browser API Mocking

```javascript
// Mock localStorage
const mockLocalStorage = {
  storage: {},
  getItem: vi.fn(function(key) {
    return this.storage[key] || null
  }),
  setItem: vi.fn(function(key, value) {
    this.storage[key] = String(value)
  }),
  removeItem: vi.fn(function(key) {
    delete this.storage[key]
  }),
  clear: vi.fn(function() {
    this.storage = {}
  })
}

vi.stubGlobal('localStorage', mockLocalStorage)

// Mock Audio API
class MockAudio {
  constructor() {
    this.play = vi.fn().mockResolvedValue(undefined)
    this.pause = vi.fn()
    this.load = vi.fn()
    this.currentTime = 0
    this.duration = 10
    this.paused = true
    this.ended = false
    this.src = ''
  }
}

vi.stubGlobal('Audio', MockAudio)

// Mock matchMedia
vi.stubGlobal('matchMedia', vi.fn(() => ({
  matches: false,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
})))
```

### Network Mocking with vi.stubGlobal

```javascript
// Mock fetch for JSON data loading
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('should load game data from JSON', async () => {
  const mockBirds = {
    us: [createTestBird({ id: 'test1', name: 'Test Bird 1' })]
  }

  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => mockBirds
  })

  const data = await loadGameData('us')
  expect(data).toEqual(mockBirds)
})

test('should handle fetch errors with retry', async () => {
  global.fetch
    .mockRejectedValueOnce(new Error('Network error'))
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ us: [] })
    })

  const data = await loadGameData('us')
  expect(global.fetch).toHaveBeenCalledTimes(3)
  expect(data).toEqual({ us: [] })
})
```

### Module Mocking with vi.mock()

```javascript
// Mock utility module
vi.mock('@/utils/StorageUtils', () => ({
  getStorage: vi.fn((key, defaultValue) => defaultValue),
  setStorage: vi.fn(),
  removeStorage: vi.fn(),
  isStorageAvailable: vi.fn(() => true)
}))

// Mock Zustand store
vi.mock('@/stores/normalGameStore', () => ({
  useNormalGameStore: vi.fn()
}))

// Test uses mocked implementation
test('should call storage utilities', () => {
  const { getStorage, setStorage } = require('@/utils/StorageUtils')

  getStorage('test-key', 'default')
  expect(getStorage).toHaveBeenCalledWith('test-key', 'default')
})
```

### MSW (Mock Service Worker) for API Mocking

**Recommendation:** MSW is overkill for this codebase. Use vi.stubGlobal for fetch mocking instead.

**Rationale:**
- This codebase doesn't make external API calls at runtime (data is pre-fetched as JSON)
- Network mocking is limited to JSON file loading
- vi.stubGlobal provides sufficient control for integration tests
- MSW adds complexity without significant benefit

## 4. Integration Test Patterns

### Pattern 1: Testing Complete Workflows

```javascript
test('should complete full daily game flow', async () => {
  // Arrange: Setup initial state
  const gameState = createTestGameState()
  const testBird = createTestBird({ id: 'amerob', name: 'American Robin' })
  const dailyEntry = createDailyEntry({ answerHash: hashBirdId('amerob') })

  // Act: Load daily bird
  setStorage('audio-birdle-game-state', gameState)
  const dailyBirdId = getDailyBirdId(dailyEntry, [testBird])

  expect(dailyBirdId).toBe('amerob')

  // Act: Process incorrect guess
  let updatedState = processGuess(gameState, 'us', '2025-01-16', 'wrong-bird', 'amerob')
  expect(updatedState.dailyGames['us-2025-01-16'].guesses).toHaveLength(1)
  expect(updatedState.dailyGames['us-2025-01-16'].won).toBe(false)

  // Act: Process correct guess
  updatedState = processGuess(updatedState, 'us', '2025-01-16', 'amerob', 'amerob')
  expect(updatedState.dailyGames['us-2025-01-16'].won).toBe(true)
  expect(updatedState.dailyGames['us-2025-01-16'].completed).toBe(true)

  // Assert: Verify stats updated
  expect(updatedState.stats.totalGamesPlayed).toBe(1)
  expect(updatedState.stats.totalGamesWon).toBe(1)
  expect(updatedState.stats.currentStreak).toBe(1)
})
```

### Pattern 2: Testing State Persistence and Migrations

```javascript
test('should migrate v1 state to v2 format', () => {
  // Arrange: Create v1 state (old format)
  const v1State = {
    currentRegion: 'us',
    gameState: {
      guesses: [{ birdId: 'test', correct: true, timestamp: Date.now() }],
      completed: true,
      won: true
    },
    stats: {
      played: 10,
      won: 5
    }
  }

  setStorage('game-state', v1State)

  // Act: Load and migrate
  const loadedData = getStorage('game-state')
  const migratedState = ensureGameStateFormat(loadedData)

  // Assert: Verify migration
  expect(migratedState.version).toBe(2)
  expect(migratedState.dailyGames).toBeDefined()
  expect(migratedState.stats).toBeDefined()
  expect(migratedState.lastPlayed).toBeDefined()
})

test('should preserve data during migration', () => {
  const v1State = {
    currentRegion: 'eu',
    gameState: {
      guesses: [{ birdId: 'test', correct: true, timestamp: Date.now() }],
      completed: true,
      won: true
    },
    stats: {
      played: 20,
      won: 15
    }
  }

  setStorage('game-state', v1State)

  const loadedData = getStorage('game-state')
  const migratedState = ensureGameStateFormat(loadedData)

  // Verify stats preserved
  expect(migratedState.stats.totalGamesPlayed).toBeGreaterThan(0)
  expect(migratedState.stats.totalGamesWon).toBeGreaterThan(0)
})
```

### Pattern 3: Testing Error Scenarios and Recovery

```javascript
test('should handle network failures with retry', async () => {
  // Arrange: Mock fetch failures then success
  global.fetch
    .mockRejectedValueOnce(new Error('Network error'))
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ us: [createTestBird()] })
    })

  // Act: Load data with retry
  const data = await loadGameData('us')

  // Assert: Verify retry and success
  expect(global.fetch).toHaveBeenCalledTimes(3)
  expect(data.us).toHaveLength(1)
})

test('should handle localStorage quota exceeded', () => {
  // Arrange: Mock quota exceeded error
  const mockLocalStorage = {
    storage: {},
    setItem: vi.fn((key, value) => {
      if (key === 'large-key') {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      }
      this.storage[key] = value
    }),
    getItem: vi.fn(),
    removeItem: vi.fn()
  }

  vi.stubGlobal('localStorage', mockLocalStorage)

  // Act: Try to save large data
  expect(() => {
    setStorage('large-key', 'x'.repeat(10000000))
  }).not.toThrow()

  // Assert: Verify graceful degradation
  expect(mockLocalStorage.setItem).toHaveBeenCalled()
})
```

### Pattern 4: Testing Cross-Module Interactions

```javascript
test('should integrate LoadGameData with CacheUtils', async () => {
  // Arrange: Mock fetch with fresh data
  const freshData = { us: [createTestBird({ id: 'new-bird' })] }
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => freshData
  })

  // Act: Load game data (triggers cache validation)
  const data = await loadGameData('us', true) // Force refresh

  // Assert: Verify data loaded and cache updated
  expect(data).toEqual(freshData)
  expect(global.fetch).toHaveBeenCalledWith('/data/birds.json', expect.any(Object))
})

test('should integrate GameLogic with Zustand stores', () => {
  // Arrange: Setup store state
  const { setDailyGame, processGuess } = useNormalGameStore.getState()
  const testBird = createTestBird()

  setDailyGame('us', '2025-01-16', testBird)

  // Act: Process guess through store
  processGuess('us', '2025-01-16', 'wrong-bird', testBird.id)

  // Assert: Verify store updated
  const game = useNormalGameStore.getState().dailyGames['us-2025-01-16']
  expect(game.guesses).toHaveLength(1)
  expect(game.guesses[0].correct).toBe(false)
})
```

## 5. Coverage Gaps Analysis

### Current Integration Test Coverage

**Existing Integration Tests:**
1. `game-flow.test.jsx` - Game state management and persistence (257 lines)
2. `hash-consistency.test.js` - Python/JS hash consistency (4,149 bytes)
3. `test_data_pipeline_integration.py` - Data pipeline validation (10,477 bytes)

**Total:** 3 integration test files covering core game flow and cross-language consistency.

### Critical Gaps (High Priority)

1. **Audio Playback Integration** (CRITICAL)
   - **Missing:** Integration tests for AudioUtils + HTML5 Audio API
   - **Impact:** Audio failures not tested, dead URL tracking unverified
   - **Test Scenarios:**
     - Successful audio playback
     - Audio URL failures (dead URLs)
     - Dead URL tracking and exclusion
     - Audio controls state management (play, pause, stop)

2. **Store Interactions** (CRITICAL)
   - **Missing:** Integration tests for Zustand stores + persist middleware
   - **Impact:** State persistence, migration, and cross-store interactions unverified
   - **Test Scenarios:**
     - Store persistence to localStorage
     - Store version migrations (v0/v1 → v2)
     - Cross-store state consistency (normal vs hard mode)
     - Store reset and cleanup

3. **Network Error Scenarios** (HIGH)
   - **Missing:** Integration tests for RetryUtils + fetch failures
   - **Impact:** Network resilience untested, retry behavior unverified
   - **Test Scenarios:**
     - Network timeout handling
     - Fetch failures with exponential backoff
     - Malformed JSON responses
     - Retry exhaustion (max retries reached)

4. **Storage Error Scenarios** (HIGH)
   - **Missing:** Integration tests for StorageUtils + QuotaExceededError
   - **Impact:** Storage error handling unverified, data loss risk
   - **Test Scenarios:**
     - localStorage quota exceeded
     - Corrupted JSON in localStorage
     - localStorage unavailable (private mode)
     - Storage cleanup and recovery

### Important Gaps (Medium Priority)

5. **Data Loading with Cache Validation**
   - **Missing:** Integration tests for LoadGameData + CacheUtils
   - **Impact:** Cache validation logic untested, stale data risk
   - **Test Scenarios:**
     - Fresh data loading
     - Cached data reuse
     - Force refresh behavior
     - Cache invalidation on date change

6. **Daily Bird Selection with Fallbacks**
   - **Missing:** Integration tests for DailyBirdUtils + hash + random fallback
   - **Impact:** Fallback logic untested, hash lookup failures unhandled
   - **Test Scenarios:**
     - Hash-based bird selection
     - Hash lookup failure → random fallback
     - Date change handling
     - Region-specific daily birds

7. **State Migration Scenarios**
   - **Missing:** Integration tests for v1 → v2 migrations
   - **Impact:** Migration success unverified, data loss risk
   - **Test Scenarios:**
     - v1 state migration (complete data)
     - v1 state migration (partial data)
     - Corrupted state recovery
     - Version 2 state handling (no migration needed)

8. **Hard Mode Integration**
   - **Missing:** Integration tests for hard mode game flow
   - **Impact:** Hard mode specific features untested
   - **Test Scenarios:**
     - Hard mode guess processing
     - Taxonomic scoring (order, family, genus, species)
     - Progressive hint timing
     - Hard mode stats tracking

### Nice-to-Have Gaps (Low Priority)

9. **Practice Mode Integration**
   - **Test Scenarios:**
     - Unlimited rounds
     - No persistence behavior
     - State reset between games

10. **Cross-Mode State Consistency**
    - **Test Scenarios:**
      - Normal mode vs hard mode stats separation
      - Practice mode doesn't affect persistent stats
      - Region-specific state isolation

11. **Hash Collision Handling**
    - **Test Scenarios:**
      - Unlikely but possible hash collision
      - Fallback behavior on collision
      - Multiple birds with same hash

12. **Empty Data Sets**
    - **Test Scenarios:**
      - No birds available for region
      - No regions available
      - Empty daily.json
      - Empty birds.json

### Prioritized Gap Summary

| Priority | Gap Area | Test Scenarios | Impact |
|----------|----------|----------------|---------|
| CRITICAL | Audio Playback Integration | 4 scenarios | Audio failures, dead URL tracking |
| CRITICAL | Store Interactions | 4 scenarios | State persistence, migrations, cross-store consistency |
| HIGH | Network Error Scenarios | 4 scenarios | Network resilience, retry behavior |
| HIGH | Storage Error Scenarios | 4 scenarios | Storage error handling, data loss risk |
| MEDIUM | Data Loading with Cache | 4 scenarios | Cache validation, stale data |
| MEDIUM | Daily Bird Selection | 4 scenarios | Fallback logic, hash failures |
| MEDIUM | State Migration | 4 scenarios | Migration success, data loss risk |
| MEDIUM | Hard Mode Integration | 4 scenarios | Hard mode specific features |
| LOW | Practice Mode Integration | 3 scenarios | Unlimited rounds, no persistence |
| LOW | Cross-Mode State Consistency | 3 scenarios | Stats separation, isolation |

## 6. Anti-Patterns to Avoid

### Anti-Pattern 1: Testing Implementation Details

```javascript
// BAD: Tests internal implementation
test('should set guesses array', () => {
  gameState.dailyGames['us-2025-01-16'].guesses = []
  expect(gameState.dailyGames['us-2025-01-16'].guesses).toEqual([])
})

// GOOD: Tests observable behavior
test('should record guess when user makes selection', () => {
  const result = processGuess(gameState, 'us', '2025-01-16', 'bird-id', 'correct-id')
  expect(result.dailyGames['us-2025-01-16'].guesses).toHaveLength(1)
})
```

### Anti-Pattern 2: Over-Mocking

```javascript
// BAD: Mocks everything, tests nothing real
vi.mock('@/utils/GameLogic')
vi.mock('@/utils/StorageUtils')
vi.mock('@/utils/DailyBirdUtils')

test('should call game logic', () => {
  processGuess()
  expect(GameLogic.processGuess).toHaveBeenCalled()
})

// GOOD: Mocks only external dependencies
vi.stubGlobal('localStorage', mockLocalStorage)

test('should process guess and update state', () => {
  const result = processGuess(gameState, 'us', '2025-01-16', 'bird-id', 'correct-id')
  expect(result.dailyGames['us-2025-01-16'].won).toBe(true)
})
```

### Anti-Pattern 3: Testing Multiple Things in One Test

```javascript
// BAD: Tests too many things
test('should do everything', () => {
  // Tests loading, processing, persistence, stats, migration...
  expect(1).toBe(1)
})

// GOOD: One assertion per test
test('should load daily bird data', () => {
  const bird = loadDailyBirdData('us', '2025-01-16')
  expect(bird).toBeDefined()
})

test('should process guess correctly', () => {
  const result = processGuess(gameState, 'us', '2025-01-16', 'bird-id', 'correct-id')
  expect(result.dailyGames['us-2025-01-16'].won).toBe(true)
})
```

### Anti-Pattern 4: Brittle Time-Based Tests

```javascript
// BAD: Depends on system time
test('should set timestamp', () => {
  const guess = { birdId: 'test', correct: true, timestamp: Date.now() }
  expect(guess.timestamp).toBeCloseTo(Date.now(), -3)
})

// GOOD: Control time in tests
test('should set timestamp', () => {
  vi.useFakeTimers()
  vi.setSystemTime(1000000)

  const guess = { birdId: 'test', correct: true, timestamp: Date.now() }
  expect(guess.timestamp).toBe(1000000)

  vi.useRealTimers()
})
```

## 7. Recommendations for Plans 02-05

### Plan 02: Create Integration Test Infrastructure

1. **Create test fixtures directory:** `tests/integration/fixtures/`
   - Add factory functions file: `factories.js`
   - Add test data file: `testData.js`

2. **Create test utilities file:** `tests/integration/testHelpers.js`
   - Mock setup functions
   - Assertion helpers
   - Common test patterns

3. **Update vitest.config.js** (if needed)
   - Add integration test paths
   - Configure timeout for integration tests
   - Add coverage exclusions for test helpers

### Plan 03: Add Integration Tests for Core Game Flows

Priority order based on gap analysis:

1. **Audio Playback Integration** (CRITICAL)
   - File: `tests/integration/audio-playback-integration.test.jsx`
   - Test scenarios from gap analysis

2. **Store Interactions** (CRITICAL)
   - File: `tests/integration/store-interactions.test.jsx`
   - Test scenarios from gap analysis

3. **Network Error Scenarios** (HIGH)
   - File: `tests/integration/network-errors-integration.test.jsx`
   - Test scenarios from gap analysis

4. **Storage Error Scenarios** (HIGH)
   - File: `tests/integration/storage-errors-integration.test.jsx`
   - Test scenarios from gap analysis

### Plan 04: Add Edge Case Tests for Error Scenarios

Priority order based on gap analysis:

1. **Data Loading with Cache Validation** (MEDIUM)
   - File: `tests/integration/data-loading-integration.test.jsx`

2. **Daily Bird Selection with Fallbacks** (MEDIUM)
   - File: `tests/integration/daily-bird-selection-integration.test.jsx`

3. **State Migration Scenarios** (MEDIUM)
   - File: `tests/integration/state-migration-integration.test.jsx`

4. **Hard Mode Integration** (MEDIUM)
   - File: `tests/integration/hard-mode-integration.test.jsx`

### Plan 05: Document Testing Patterns and Update Coverage

1. **Update tests/integration/README.md**
   - Add fixture patterns section
   - Add mocking strategy section
   - Add integration test patterns section
   - Update examples with new patterns

2. **Update .planning/codebase/TESTING.md**
   - Add integration testing patterns
   - Document fixture strategy
   - Update coverage targets if needed

3. **Generate coverage report**
   - Run `npm run test:coverage`
   - Identify remaining gaps
   - Update coverage thresholds in vitest.config.js if needed

## 8. Summary

**Key Takeaways:**

1. **Vitest is well-suited for integration testing** - jsdom environment, comprehensive mocking, and test.extend() fixtures provide excellent support

2. **Feature-based organization preferred** - Group tests by feature (game-flow, data-loading, state-management) for better discoverability

3. **Fixture strategy critical** - Create reusable factory functions for game states, bird data, regions, daily entries

4. **Mock only external dependencies** - Use real implementations for business logic, mock browser APIs and network operations

5. **Coverage gaps identified** - 12 major gap areas, with 4 critical gaps (audio, stores, network, storage) requiring immediate attention

6. **Anti-patterns to avoid** - Don't test implementation details, don't over-mock, keep tests focused, avoid brittle time-based tests

**Next Steps:**

- Plan 02: Create integration test infrastructure (fixtures, test helpers)
- Plan 03: Add integration tests for core game flows (4 critical areas)
- Plan 04: Add edge case tests for error scenarios (4 medium priority areas)
- Plan 05: Document testing patterns and update coverage

---

*Discovery Document: Phase 5 Plan 01*
*Integration Testing Research and Recommendations*
*2026-01-16*
