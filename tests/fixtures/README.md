# Test Fixtures

This directory contains reusable test fixtures and factory functions for integration tests.

## Purpose

Test fixtures provide consistent, reusable test data that helps keep tests clean and maintainable. Instead of creating test data inline in every test, you can use these factory functions to generate standard test objects with sensible defaults.

## Available Fixtures

### Bird Data Factories

#### `createTestBird(overrides = {})`

Creates a single test bird object with sensible defaults.

**Returns:** Bird object

**Example:**

```javascript
import { createTestBird } from "@/test/fixtures/integration-fixtures";

const bird = createTestBird({ id: "amerob", name: "American Robin" });
```

#### `createTestBirdList(count = 10, overrides = {})`

Creates an array of test birds.

**Parameters:**

- `count` - Number of birds to create (default: 10)
- `overrides` - Object to override defaults for all birds

**Returns:** Array of bird objects

**Example:**

```javascript
const birds = createTestBirdList(50, { order: "Passeriformes" });
```

### Game State Factories

#### `createTestGameState(overrides = {})`

Creates a complete game state object (version 2 format).

**Returns:** Game state object with empty dailyGames, hardModeGames, and initialized stats

**Example:**

```javascript
const gameState = createTestGameState({
  dailyGames: {
    "us-2025-01-15": createTestDailyGame(),
  },
});
```

#### `createTestDailyGame(overrides = {})`

Creates a daily game object for a specific region and date.

**Returns:** Daily game object

**Example:**

```javascript
const dailyGame = createTestDailyGame({
  region: "eu",
  date: "2025-01-16",
  won: true,
});
```

#### `createCompletedGame(won = true, guesses = 1, overrides = {})`

Creates a completed game with guess history.

**Parameters:**

- `won` - Whether the game was won (default: true)
- `guesses` - Number of guesses made (default: 1)
- `overrides` - Object to override defaults

**Returns:** Completed game object

**Example:**

```javascript
const wonGame = createCompletedGame(true, 3);
const lostGame = createCompletedGame(false, 4);
```

### Hard Mode Factories

#### `createHardModeGame(overrides = {})`

Creates a hard mode game object.

**Returns:** Hard mode game object

**Example:**

```javascript
const hardGame = createHardModeGame({
  date: "2025-01-17",
  maxGuesses: 6,
});
```

#### `createHardModeGuess(overrides = {})`

Creates a hard mode guess with taxonomic scoring.

**Returns:** Hard mode guess object

**Example:**

```javascript
const guess = createHardModeGuess({
  birdId: "target-bird",
  textInput: "Target Bird",
  correct: true,
  taxonomicScore: {
    order: true,
    family: true,
    genus: true,
    species: true,
  },
});
```

### Region Data Factories

#### `createTestRegion(overrides = {})`

Creates a test region object.

**Returns:** Region object

**Example:**

```javascript
const region = createTestRegion({
  code: "uk",
  name: "United Kingdom",
  subregions: ["uk-eng", "uk-sco", "uk-wal"],
});
```

#### `createTestRegionList()`

Creates a list of common test regions (US, EU, AS).

**Returns:** Array of region objects

**Example:**

```javascript
const regions = createTestRegionList();
```

### Daily Entry Factories

#### `createTestDailyEntry(overrides = {})`

Creates a daily challenge entry.

**Returns:** Daily entry object

**Example:**

```javascript
const entry = createTestDailyEntry({
  date: "2025-01-17",
  region: "eu",
  answerHash: hashBirdId("target-bird"),
});
```

### Mock Data Helpers

#### `createMockBirdDataByRegion()`

Creates mock bird data organized by region.

**Returns:** Object with region codes as keys and bird arrays as values

**Example:**

```javascript
const birdData = createMockBirdDataByRegion();
// { us: [...50 birds], eu: [...40 birds], as: [...45 birds] }
```

#### `createMockDailyData()`

Creates mock daily challenge data for multiple dates.

**Returns:** Array of daily entry objects

**Example:**

```javascript
const dailyData = createMockDailyData();
// [3 daily entries for 2025-01-13, 2025-01-14, 2025-01-15]
```

## Usage Patterns

### Basic Usage

```javascript
import { describe, it, expect } from "vitest";
import {
  createTestBird,
  createTestGameState,
} from "@/test/fixtures/integration-fixtures";

describe("Game Logic Integration", () => {
  it("should process guess correctly", () => {
    const gameState = createTestGameState({
      dailyGames: {
        "us-2025-01-15": createTestDailyGame(),
      },
    });
    const bird = createTestBird({ id: "target-bird" });

    // Test code here
  });
});
```

### Override Defaults

```javascript
// Create custom bird with specific properties
const bird = createTestBird({
  id: "amerob",
  name: "American Robin",
  order: "Passeriformes",
  family: "Turdidae (Turdidae)",
  audioUrl: ["http://example.com/robin.mp3"],
});

// Create game state with existing games
const gameState = createTestGameState({
  stats: {
    totalGamesPlayed: 10,
    totalGamesWon: 7,
    currentStreak: 3,
  },
});
```

### Create Complex Scenarios

```javascript
// Create completed game with specific guess history
const game = createCompletedGame(true, 3, {
  region: "eu",
  date: "2025-01-16",
  guesses: [
    { birdId: "wrong1", correct: false, timestamp: Date.now() - 2000 },
    { birdId: "wrong2", correct: false, timestamp: Date.now() - 1000 },
    { birdId: "correct", correct: true, timestamp: Date.now() },
  ],
});

// Create hard mode game with taxonomic hints
const hardGame = createHardModeGame({
  guesses: [
    createHardModeGuess({
      textInput: "Wrong Bird",
      taxonomicScore: {
        order: true,
        family: false,
        genus: false,
        species: false,
      },
    }),
  ],
});
```

## Best Practices

1. **Use fixtures for consistent test data** - Avoid creating test data inline in tests
2. **Override defaults with parameter** - Use the `overrides` parameter to create variations
3. **Keep fixtures simple** - Don't add complex logic to fixture functions
4. **Import from @test alias** - Use `@test/fixtures/integration-fixtures` for clean imports
5. **Combine fixtures** - Use multiple fixtures together to create complex scenarios

## Related Documentation

- [Integration Test Patterns](../integration/README.md) - Integration testing patterns and examples
- [05-01-DISCOVERY.md](../../.planning/phases/05-testing-foundation/05-01-DISCOVERY.md) - Integration testing research and recommendations
- [TESTING.md](../../.planning/codebase/TESTING.md) - Testing overview and conventions

## Contributing

When adding new fixtures:

1. Add factory functions to `integration-fixtures.jsx`
2. Document the function in this README
3. Include JSDoc comments in the source code
4. Add usage examples
5. Keep fixtures focused and reusable
