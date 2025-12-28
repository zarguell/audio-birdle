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

# Run with coverage
npm test -- tests/integration --coverage

# Watch mode
npm test -- tests/integration --watch
```

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

Avoid:
- Testing what unit tests already cover
- UI/components (those belong in unit or E2E tests)
- Implementation details of single modules
