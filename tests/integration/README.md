# Integration Tests

This directory contains integration tests that verify the interaction between multiple modules without requiring a full browser environment.

## Test Files

### JavaScript Integration Tests

#### `hash-consistency.test.js`
**Purpose:** Verify Python and JavaScript produce identical hashes for bird IDs.

**Why it matters:** The daily bird system depends on hash consistency. If `generate-daily-birds.py` and `HashUtils.jsx` produce different hashes, all daily birds will be incorrect.

**What it tests:**
- JavaScript hash function produces consistent 8-character hex hashes
- Hash values match Python implementation for known bird IDs
- Edge cases (empty strings, special characters, uppercase/lowercase)
- Salt consistency between implementations

**Running:**
```bash
npm test -- tests/integration/hash-consistency.test.js
```

**Setup required:**
1. Generate Python hash values:
   ```bash
   python scripts/verify_hash_consistency.py
   ```
2. Copy the output into `PYTHON_HASH_OUTPUTS` in the test file
3. Run tests to verify consistency

#### `game-flow.test.jsx`
**Purpose:** Test complete game workflows from data loading through state persistence.

**What it tests:**
- Daily game initialization (load data → get bird → create state)
- Guess processing (correct/incorrect, game completion, win/loss)
- State persistence (save/load localStorage)
- State migration (v1 → v2 format)
- Statistics aggregation across multiple games and regions

**Running:**
```bash
npm test -- tests/integration/game-flow.test.jsx
```

#### `audio-playback.test.jsx`
**Purpose:** Test audio playback integration across multiple modules.

**What it tests:**
- Audio loading from game data
- Play/pause controls
- Volume adjustment
- Audio state persistence
- Error handling for missing audio URLs
- Audio cache behavior

**Running:**
```bash
npm test -- tests/integration/audio-playback.test.jsx
```

#### `store-interactions.test.jsx`
**Purpose:** Test Zustand store interactions with game logic.

**What it tests:**
- Store initialization and hydration
- State updates through store actions
- Persistence middleware behavior
- Store migration (v0/v1 → v2)
- Cross-store independence (normal, hard, practice modes)
- Statistics tracking and updates

**Running:**
```bash
npm test -- tests/integration/store-interactions.test.jsx
```

#### `data-loading.test.jsx`
**Purpose:** Test data loading pipeline from JSON to application state.

**What it tests:**
- Loading birds.json by region
- Loading regions.json
- Loading daily.json for daily challenges
- Cache behavior and version checking
- Fresh data loading with cache bypass
- Error handling for missing data files
- Malformed data recovery

**Running:**
```bash
npm test -- tests/integration/data-loading.test.jsx
```

#### `error-scenarios.test.jsx`
**Purpose:** Test graceful error handling across the application.

**What it tests:**
- Empty bird list handling
- Malformed JSON data recovery
- Missing daily entry fallback to hash-based selection
- localStorage quota exceeded errors
- State corruption recovery
- Graceful degradation when data is unavailable

**Running:**
```bash
npm test -- tests/integration/error-scenarios.test.jsx
```

#### `network-failures.test.jsx`
**Purpose:** Test network resilience and retry behavior.

**What it tests:**
- RetryWithBackoff behavior on network failures
- Exponential backoff timing
- Maximum retry limits
- Recovery after network returns
- Timeout handling
- Fetch error propagation

**Running:**
```bash
npm test -- tests/integration/network-failures.test.jsx
```

### Python Integration Tests

#### `test_data_pipeline_integration.py`
**Purpose:** Validate generated JSON data files and cross-references between them.

**What it tests:**
- JSON schema validation (birds.json, regions.json, daily.json, history.json)
- Cross-reference validation (regions in birds.json exist in regions.json)
- Data completeness (all birds have required fields)
- No duplicate entries in daily.json
- Audio URL formatting
- Subregion reference validity
- No empty bird lists for any region

**Running:**
```bash
pytest tests/integration/test_data_pipeline_integration.py -v
```

**No setup required** - uses existing data files in `public/data/`

## Running All Integration Tests

### JavaScript
```bash
# Run all JS integration tests
npm run test:integration

# Run specific test file
npm test -- tests/integration/audio-playback.test.jsx

# Run with coverage
npm test -- tests/integration --coverage

# Watch mode
npm test -- tests/integration --watch

# Run specific test pattern
npm test -- tests/integration --grep "audio"
```

### Test Timeouts

Integration tests that involve async operations may need longer timeouts:

```javascript
import { test } from 'vitest'

test('should load data with retry', async () => {
  // Test with retries may take longer
  const data = await loadGameData('us', true)
  expect(data).toBeDefined()
}, { timeout: 10000 })  // 10 second timeout
```

Default timeout is 5000ms. Increase only when necessary.

### Python
```bash
# Run all Python integration tests
pytest tests/integration/ -v

# Run specific file
pytest tests/integration/test_data_pipeline_integration.py -v

# With coverage (excludes integration tests from coverage calculation)
pytest tests/integration/ -v --no-cov
```

## CI Integration

Integration tests run automatically in CI when:
- Commit type is `daily`, `fix`, or `feature`
- Test category is `full`

See [`.github/workflows/smart-test.yml`](../.github/workflows/smart-test.yml) for details.

## Value of These Tests

### Without Browser Overhead

These integration tests provide high value by testing:
1. **Cross-language consistency** - Python scripts and JavaScript modules must agree on hash values
2. **End-to-end workflows** - Complete game flows without UI components
3. **Data pipeline integrity** - Generated data files are valid and cross-referenced
4. **State management** - Persistence, migration, and aggregation logic

### What They Don't Test

These tests intentionally avoid:
- DOM manipulation (no `@testing-library/react` needed)
- User interactions (clicks, typing, etc.)
- Visual rendering (no snapshots needed)
- Browser APIs (beyond what's mocked in setup.js)

For full browser testing, consider adding E2E tests with Playwright or Cypress if needed in the future.

## Adding New Integration Tests

When adding integration tests, focus on:
1. **Module interactions** - How multiple utilities work together
2. **Data flows** - From input through processing to output/storage
3. **Cross-language contracts** - Python ↔ JavaScript agreements
4. **Critical paths** - Happy paths and important edge cases

## Fixture Patterns

### Using Factory Functions

Integration tests should use reusable factory functions for test data:

```javascript
// Create test game state
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
      regionStats: {}
    },
    ...overrides
  }
}

// Create test bird data
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

// Create completed game
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

### Using Centralized Fixtures

**Location:** `tests/fixtures/integration-fixtures.jsx`

Import factory functions from centralized fixtures:

```javascript
import {
  createTestBird,
  createTestBirdList,
  createTestGameState,
  createTestDailyGame,
  createTestRegion,
  createTestDailyEntry
} from '@/test/fixtures/integration-fixtures'

// Create a single test bird with custom properties
const customBird = createTestBird({
  id: 'robin',
  name: 'American Robin',
  order: 'Passeriformes'
})

// Create multiple birds for testing
const birdList = createTestBirdList(5, {
  order: 'Passeriformes'  // Applied to all birds
})

// Create test game state with custom stats
const gameState = createTestGameState({
  stats: {
    totalGamesPlayed: 10,
    totalGamesWon: 7
  }
})

// Create a complete daily game entry
const dailyGame = createTestDailyGame({
  region: 'us',
  date: '2025-01-16',
  won: true,
  guesses: 3
})
```

**Available Factory Functions:**
- `createTestBird(overrides)` - Create test bird data
- `createTestBirdList(count, overrides)` - Create multiple test birds
- `createTestGameState(overrides)` - Create test game state
- `createTestDailyGame(overrides)` - Create test daily game
- `createTestRegion(overrides)` - Create test region data
- `createTestDailyEntry(overrides)` - Create test daily entry

**See also:** [tests/fixtures/README.md](../fixtures/README.md) for complete fixture documentation.

### Setup/Teardown Patterns

Use `beforeEach` and `afterEach` for consistent test setup:

```javascript
describe('Game Flow Integration', () => {
  let mockLocalStorage

  beforeEach(() => {
    mockLocalStorage = {
      storage: {},
      getItem(key) { return this.storage[key] || null },
      setItem(key, value) { this.storage[key] = value },
      removeItem(key) { delete this.storage[key] },
      clear() { this.storage = {} }
    }

    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('Audio', vi.fn(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn()
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockLocalStorage.clear()
  })

  it('should test game flow', () => {
    // Test using setup mocks
  })
})
```

### Using test.extend() for Custom Fixtures

For complex fixture setups, use Vitest's `test.extend()`:

```javascript
import { test as base } from 'vitest'

const test = base.extend({
  clearStorage: async ({}, use) => {
    const keys = Object.keys(localStorage)
    keys.forEach(key => localStorage.removeItem(key))
    await use()
  },

  gameState: async ({}, use) => {
    const state = createTestGameState()
    await use(state)
  }
})

test.use(clearStorage)

test('should load and save game state', async ({ gameState }) => {
  expect(gameState).toBeDefined()
})
```

## Mocking Strategy

### When to Mock vs Real Implementations

**Mock When:**
- External dependencies (fetch API, browser localStorage, Audio API)
- Network operations (eBird API calls, JSON file downloads)
- Browser APIs (matchMedia, service workers)
- Time-dependent operations (Date.now, setTimeout)

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
  }
}

vi.stubGlobal('Audio', MockAudio)
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
  const mockBirds = { us: [createTestBird()] }

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
})
```

## Integration Test Patterns

### Workflow Testing

**Purpose:** Test complete user flows across multiple modules.

```javascript
test('should complete full daily game flow', async () => {
  // Arrange: Setup initial state
  const gameState = createTestGameState()
  const testBird = createTestBird({ id: 'amerob', name: 'American Robin' })

  // Act: Process guess
  let updatedState = processGuess(gameState, 'us', '2025-01-16', 'amerob', 'amerob')

  // Assert: Verify complete flow
  expect(updatedState.dailyGames['us-2025-01-16'].won).toBe(true)
  expect(updatedState.stats.totalGamesWon).toBe(1)
})
```

**Key aspects:**
- Load data from one module (LoadGameData)
- Initialize game in another (DailyGameUtils)
- Process guesses through GameLogic
- Update state through store actions
- Persist state via StorageUtils
- Verify stats aggregation

### Error Scenario Testing

**Purpose:** Test graceful degradation when things go wrong.

```javascript
test('should handle network failures with retry', async () => {
  global.fetch
    .mockRejectedValueOnce(new Error('Network error'))
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ us: [createTestBird()] })
    })

  const data = await loadGameData('us')

  expect(global.fetch).toHaveBeenCalledTimes(3)
  expect(data.us).toHaveLength(1)
})
```

**Common error scenarios:**
- Empty data files (empty bird list, no daily entry)
- Malformed JSON data (missing fields, wrong types)
- Network failures (retries, backoff, timeout)
- localStorage errors (quota exceeded, disabled)
- Missing audio URLs (fallback to next bird)

### State Persistence Testing

**Purpose:** Verify state survives page reloads and migrates correctly.

```javascript
test('should migrate v1 state to v2 format', () => {
  const v1State = {
    currentRegion: 'us',
    gameState: {
      guesses: [{ birdId: 'test', correct: true, timestamp: Date.now() }],
      completed: true,
      won: true
    },
    stats: { played: 10, won: 5 }
  }

  setStorage('game-state', v1State)

  const loadedData = getStorage('game-state')
  const migratedState = ensureGameStateFormat(loadedData)

  expect(migratedState.version).toBe(2)
  expect(migratedState.dailyGames).toBeDefined()
})
```

**Test:**
- Fresh installation (no localStorage)
- Existing state persistence and hydration
- Format migration (v0/v1 → v2)
- Cross-region state independence
- Stats persistence across sessions

### Cross-Module Testing

**Purpose:** Verify multiple utilities work together correctly.

```javascript
test('should integrate LoadGameData with CacheUtils', async () => {
  const freshData = { us: [createTestBird({ id: 'new-bird' })] }

  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => freshData
  })

  const data = await loadGameData('us', true)

  expect(data).toEqual(freshData)
  expect(global.fetch).toHaveBeenCalledWith('/data/birds.json', expect.any(Object))
})
```

**Test:**
- AudioUtils integrates with StorageUtils for volume persistence
- LoadGameData integrates with CacheUtils for version checking
- GameLogic integrates with store actions for state updates
- HashUtils integrates with DailyBirdUtils for bird selection

## Anti-Patterns to Avoid

### Don't Test Implementation Details

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

### Don't Over-Mock

```javascript
// BAD: Mocks everything, tests nothing real
vi.mock('@/utils/GameLogic')
vi.mock('@/utils/StorageUtils')

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

### Don't Test Multiple Things in One Test

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

## Adding New Integration Tests

When adding integration tests, focus on:
1. **Module interactions** - How multiple utilities work together
2. **Data flows** - From input through processing to output/storage
3. **Cross-language contracts** - Python ↔ JavaScript agreements
4. **Critical paths** - Happy paths and important edge cases
5. **Error scenarios** - Network failures, storage errors, bad data

Avoid:
- Testing what unit tests already cover
- UI/components (those belong in unit or E2E tests)
- Implementation details of single modules
- Over-mocking external dependencies
- Testing multiple concerns in one test
