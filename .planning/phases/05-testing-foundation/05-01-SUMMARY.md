# Phase 5 Plan 01: Summary

**Completed:** 2026-01-16
**Phase:** 05-Testing-Foundation
**Plan:** 01 - Research and establish integration testing patterns

## Objectives Completed

### 1. Created Discovery Document (.planning/phases/05-testing-foundation/05-01-DISCOVERY.md)

**Document Size:** 847 lines
**Sections:**
1. Test Organization
2. Fixture Patterns
3. Mocking Strategy
4. Integration Test Patterns
5. Coverage Gaps Analysis (12 major gap areas identified)
6. Anti-Patterns to Avoid
7. Recommendations for Plans 02-05
8. Summary

**Key Findings:**
- Vitest provides excellent integration testing support with jsdom environment
- Feature-based organization preferred for test discoverability
- Fixture strategy critical for reusable test data
- 12 major coverage gaps identified (4 critical, 4 high, 4 medium priority)

### 2. Analyzed Existing Integration Tests

**Current State:**
- 3 integration test files exist
- `game-flow.test.jsx` (257 lines) - Game state management and persistence
- `hash-consistency.test.js` (4,149 bytes) - Python/JS hash consistency
- `test_data_pipeline_integration.py` (10,477 bytes) - Data pipeline validation

**Gaps Identified:**
1. **Audio Playback Integration** (CRITICAL) - No tests for AudioUtils + HTML5 Audio API
2. **Store Interactions** (CRITICAL) - No tests for Zustand stores + persist middleware
3. **Network Error Scenarios** (HIGH) - No tests for RetryUtils + fetch failures
4. **Storage Error Scenarios** (HIGH) - No tests for StorageUtils + QuotaExceededError
5. **Data Loading with Cache** (MEDIUM) - No tests for LoadGameData + CacheUtils
6. **Daily Bird Selection** (MEDIUM) - No tests for hash + random fallback
7. **State Migration** (MEDIUM) - No tests for v1 → v2 migrations
8. **Hard Mode Integration** (MEDIUM) - No tests for hard mode game flow

### 3. Defined Test Fixture Strategy

**Factory Functions Created:**
```javascript
createTestGameState(overrides = {})
createTestBird(overrides = {})
createTestRegion(overrides = {})
createDailyEntry(overrides = {})
createCompletedGame(won, guesses, overrides = {})
```

**Setup/Teardown Patterns Documented:**
- beforeEach/afterEach for localStorage cleanup
- vi.stubGlobal() for browser API mocks
- test.extend() for custom fixtures

### 4. Updated Integration Testing Guide (tests/integration/README.md)

**New Sections Added:**
- Fixture Patterns (factory functions, setup/teardown, test.extend())
- Mocking Strategy (when to mock, browser API mocking, network mocking)
- Integration Test Patterns (complete workflows, error scenarios, persistence, cross-module)
- Anti-Patterns to Avoid (implementation details, over-mocking, multiple concerns)

**File Size Increased:** 135 lines → 305 lines (170 new lines)

## Technical Decisions

### Test Organization

**Decision:** Feature-based organization preferred over module-based

**Rationale:**
- Better test discoverability
- Logical grouping of related workflows
- Easier to find tests for specific features
- Aligns with user-facing functionality

**Structure:**
```
tests/integration/
├── game-flow/               # Complete game workflows
├── data-loading/            # Data loading and caching
├── state-management/        # Store and persistence
├── error-scenarios/         # Error handling and recovery
└── cross-language/          # Python/JS consistency
```

### Mocking Strategy

**Decision:** Mock only external dependencies, use real implementations for business logic

**Rationale:**
- Tests verify actual behavior, not mocked behavior
- More confidence in test results
- Less maintenance overhead
- Catches integration issues between modules

**What to Mock:**
- Browser APIs (localStorage, Audio, fetch, matchMedia)
- Network operations (eBird API, JSON downloads)
- Time-dependent operations (Date.now, setTimeout)

**What NOT to Mock:**
- Business logic functions (GameLogic, TaxonomyUtils)
- Data transformation utilities
- State management logic (Zustand stores)
- Hash functions (HashUtils)

### MSW vs vi.stubGlobal

**Decision:** Use vi.stubGlobal for fetch mocking instead of MSW

**Rationale:**
- This codebase doesn't make external API calls at runtime
- Network mocking is limited to JSON file loading
- vi.stubGlobal provides sufficient control for integration tests
- MSW adds complexity without significant benefit

## Coverage Gaps Identified

### Critical Gaps (Immediate Attention)

| Gap Area | Test Scenarios | Impact |
|----------|----------------|---------|
| Audio Playback Integration | 4 scenarios | Audio failures, dead URL tracking |
| Store Interactions | 4 scenarios | State persistence, migrations, cross-store consistency |
| Network Error Scenarios | 4 scenarios | Network resilience, retry behavior |
| Storage Error Scenarios | 4 scenarios | Storage error handling, data loss risk |

### Medium Priority Gaps

| Gap Area | Test Scenarios | Impact |
|----------|----------------|---------|
| Data Loading with Cache | 4 scenarios | Cache validation, stale data |
| Daily Bird Selection | 4 scenarios | Fallback logic, hash failures |
| State Migration | 4 scenarios | Migration success, data loss risk |
| Hard Mode Integration | 4 scenarios | Hard mode specific features |

### Low Priority Gaps

| Gap Area | Test Scenarios | Impact |
|----------|----------------|---------|
| Practice Mode Integration | 3 scenarios | Unlimited rounds, no persistence |
| Cross-Mode State Consistency | 3 scenarios | Stats separation, isolation |

## Recommendations for Plans 02-05

### Plan 02: Create Integration Test Infrastructure

1. Create `tests/integration/fixtures/` directory
2. Create factory functions file: `factories.js`
3. Create test helpers file: `testHelpers.js`
4. Update `vitest.config.js` if needed

### Plan 03: Add Integration Tests for Core Game Flows

Priority order:
1. Audio Playback Integration (CRITICAL)
2. Store Interactions (CRITICAL)
3. Network Error Scenarios (HIGH)
4. Storage Error Scenarios (HIGH)

### Plan 04: Add Edge Case Tests for Error Scenarios

Priority order:
1. Data Loading with Cache Validation (MEDIUM)
2. Daily Bird Selection with Fallbacks (MEDIUM)
3. State Migration Scenarios (MEDIUM)
4. Hard Mode Integration (MEDIUM)

### Plan 05: Document Testing Patterns and Update Coverage

1. Update `tests/integration/README.md` ✓ (Completed)
2. Update `.planning/codebase/TESTING.md`
3. Generate coverage report
4. Update coverage thresholds if needed

## Files Created

- `.planning/phases/05-testing-foundation/05-01-DISCOVERY.md` (847 lines)

## Files Modified

- `tests/integration/README.md` (170 new lines added)

## Key Takeaways

1. **Vitest is well-suited for integration testing** - jsdom environment, comprehensive mocking, and test.extend() fixtures provide excellent support

2. **Feature-based organization preferred** - Group tests by feature (game-flow, data-loading, state-management) for better discoverability

3. **Fixture strategy critical** - Create reusable factory functions for game states, bird data, regions, daily entries

4. **Mock only external dependencies** - Use real implementations for business logic, mock browser APIs and network operations

5. **Coverage gaps identified** - 12 major gap areas, with 4 critical gaps requiring immediate attention

6. **Anti-patterns documented** - Clear guidance on what to avoid (implementation details, over-mocking, multiple concerns)

## Challenges and Solutions

### Challenge 1: Balancing Mock Coverage
**Issue:** How much to mock vs use real implementations
**Solution:** Mock only external dependencies, use real implementations for business logic

### Challenge 2: Test Organization
**Issue:** How to organize integration tests for discoverability
**Solution:** Feature-based organization (game-flow, data-loading, state-management, error-scenarios)

### Challenge 3: Fixture Reusability
**Issue:** Creating reusable fixtures without complexity
**Solution:** Simple factory functions with override pattern, test.extend() for complex setups

## Next Steps

1. **Plan 02:** Create integration test infrastructure (fixtures, test helpers)
2. **Plan 03:** Add integration tests for 4 critical game flow areas
3. **Plan 04:** Add integration tests for 4 medium priority error scenarios
4. **Plan 05:** Document testing patterns and update coverage thresholds

## Success Criteria

- [x] Discovery document created with comprehensive research findings
- [x] Discovery doc has at least 100 lines covering fixtures, mocking, patterns, gaps
- [x] tests/integration/README.md updated with new guidance sections
- [x] Fixture strategy documented with reusable templates
- [x] Gaps identified and prioritized for implementation

**All success criteria met.**

---

*Phase 5 Plan 01: Complete*
*Integration Testing Research and Recommendations*
*2026-01-16*
