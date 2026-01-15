# Testing Patterns

**Analysis Date:** 2026-01-15

## Test Framework

**Runner:**
- Vitest 4.0.16 - JavaScript testing
- Config: `vitest.config.js` in project root

- pytest - Python testing
- Config: `pyproject.toml` in project root

**Assertion Library:**
- Vitest built-in expect (JavaScript)
- pytest built-in assert (Python)

**Run Commands:**
```bash
# JavaScript
npm test                              # Run all tests (watch mode)
npm run test:unit                     # Unit tests only
npm run test:integration              # Integration tests
npm run test:coverage                 # Coverage report

# Python
pytest tests/ -v                      # Run all tests
pytest tests/ --cov=scripts           # With coverage
pytest tests/ -v --no-cov             # Without coverage
```

## Test File Organization

**Location:**
- JavaScript: `tests/unit/utils/` (separate directory from source)
- Python: `tests/` (separate directory from source)

**Naming:**
- JavaScript: `*.test.jsx` (e.g., `GameLogic.test.jsx`)
- Python: `test_*.py` or `*_test.py` (e.g., `test_generate_daily_birds.py`)

**Structure:**
```
tests/
├── setup.js           # Vitest environment setup
├── conftest.py        # Pytest fixtures
├── unit/             # JavaScript unit tests
│   └── utils/        # Utility module tests
│       ├── GameLogic.test.jsx
│       ├── DailyBirdUtils.test.jsx
│       ├── AudioUtils.test.jsx
│       └── StorageUtils.test.jsx
├── fixtures/         # Test data
│   └── sampleBirds.js
├── test_generate_daily_birds.py
├── test_game_data_generator.py
└── test_generate_daily_region_data.py
```

## Test Structure

**Suite Organization:**
```javascript
// JavaScript (Vitest)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('GameLogic', () => {
  it('should process correct guess', () => {
    // arrange
    const gameState = createTestGameState()
    const guess = 'correct-bird-id'

    // act
    const result = processGuess(gameState, guess)

    // assert
    expect(result.correct).toBe(true)
  })
})
```

```python
# Python (pytest)
def test_hash_bird_id():
    """Test bird ID hashing."""
    bird_id = "testbird"
    expected_hash = "a1b2c3d4"

    result = hash_bird_id(bird_id)

    assert result == expected_hash
```

**Patterns:**
- beforeEach for per-test setup
- afterEach for cleanup (restore mocks)
- Arrange/act/assert pattern in complex tests
- Descriptive test names

## Mocking

**Framework:**
- Vitest built-in mocking (vi) for JavaScript
- unittest.mock for Python

**Patterns:**
```javascript
// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
}
global.localStorage = mockLocalStorage
```

**What to Mock:**
- Browser APIs (localStorage, Audio, fetch, matchMedia)
- File system operations (for Python tests)
- External API calls (eBird API)

**What NOT to Mock:**
- Pure utility functions
- Business logic
- Data transformation functions

## Fixtures and Factories

**Test Data:**
```javascript
// Factory functions in test files
function createTestGameState(overrides = {}) {
  return {
    version: 2,
    dailyGames: {},
    stats: { totalGamesPlayed: 0, totalGamesWon: 0 },
    ...overrides
  }
}
```

```python
# Pytest fixtures in conftest.py
@pytest.fixture
def sample_taxonomy():
    """Sample taxonomy data for testing."""
    return {
        "species": [
            {"species_code": "amerob", "scientific_name": "Turdus migratorius"}
        ]
    }
```

**Location:**
- JavaScript: Factory functions in test files
- Python: Fixtures in `tests/conftest.py`
- Shared fixtures: `tests/fixtures/sampleBirds.js`

## Coverage

**Requirements:**
- 70% minimum coverage for both JavaScript and Python
- 80-85% for critical files (GameLogic, DailyBirdUtils)
- Enforced in CI (tests fail if coverage below threshold)

**Configuration:**
- Vitest: `vitest.config.js` (v8 coverage provider)
- Pytest: `pyproject.toml` (pytest-cov plugin)
- Exclusions: Test files, configuration files, build artifacts

**View Coverage:**
```bash
npm run test:coverage    # JavaScript
open coverage/index.html

pytest --cov=scripts     # Python
```

## Test Types

**Unit Tests:**
- JavaScript: Test individual utility functions in isolation
- Python: Test individual script functions
- Mock all external dependencies (localStorage, file system, APIs)
- Fast: each test <100ms

**Integration Tests:**
- JavaScript: Test multiple modules together (game flow, data loading)
- Python: Test data pipeline scripts together
- Mock only external boundaries (eBird API)
- Tests in `tests/integration/` (JavaScript), `tests/test_*_integration.py` (Python)

**E2E Tests:**
- Not currently used
- Manual testing for critical user flows

## Common Patterns

**Async Testing:**
```javascript
it('should load game data', async () => {
  const data = await loadGameData('us')
  expect(data).toBeDefined()
})
```

**Error Testing:**
```javascript
it('should throw on invalid input', () => {
  expect(() => processGuess(null, 'bird-id')).toThrow()
})
```

```python
def test_invalid_bird_id():
    """Test that invalid bird ID raises error."""
    with pytest.raises(ValueError):
        hash_bird_id(None)
```

**Mocking Browser APIs:**
```javascript
// In tests/setup.js
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
global.Audio = vi.fn()
```

**Snapshot Testing:**
- Not used in this codebase
- Prefer explicit assertions for clarity

---

*Testing analysis: 2026-01-15*
*Update when test patterns change*
