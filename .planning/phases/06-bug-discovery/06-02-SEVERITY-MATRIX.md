# Bug Severity Matrix

**Created:** 2026-01-16
**Based on:** Phase 6 Plan 06-01 Findings

## Critical Bugs (Fix Immediately)

| ID      | File                                  | Error Message                                                                                     | Impact                                                 | Estimate          | Priority |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------- | -------- |
| BUG-001 | `tests/unit/utils/GameLogic.test.jsx` | `TypeError: Cannot read properties of undefined (reading 'toFixed')` in getUserPerformanceSummary | Stats summary crashes when averageGuesses is undefined | Quick (10-15 min) | P0       |
| BUG-002 | `tests/unit/utils/GameLogic.test.jsx` | `expected undefined to be defined` in getDailyBird                                                | Daily bird selection fails silently                    | Quick (10-15 min) | P0       |

## Major Bugs (Fix Soon)

| ID      | File                                   | Error Message                                                                         | Impact                                               | Estimate           | Priority |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ | -------- |
| BUG-003 | `tests/unit/utils/CacheUtils.test.jsx` | `expected "vi.fn()" to be called with arguments` - header value mismatch (quotes)     | Version tracking fails to store correct ETag values  | Medium (20-30 min) | P1       |
| BUG-004 | `tests/unit/utils/CacheUtils.test.jsx` | `SyntaxError: Unexpected non-whitespace character after JSON` in hasDateChanged tests | Date comparison crashes on invalid localStorage data | Quick (10-15 min)  | P1       |
| BUG-005 | `tests/unit/utils/GameLogic.test.jsx`  | `expected 'amerob' to be 'barswa'` - guess processing returns wrong bird ID           | Incorrect guess data stored                          | Medium (20-30 min) | P1       |
| BUG-006 | `tests/unit/utils/GameLogic.test.jsx`  | `expected true to be false` - game completion status wrong                            | Game completion tracking broken                      | Medium (20-30 min) | P1       |
| BUG-007 | `tests/unit/utils/GameLogic.test.jsx`  | `expected 1 to be +0` - streak not resetting on loss                                  | Streak tracking broken                               | Quick (10-15 min)  | P1       |
| BUG-008 | `tests/unit/utils/GameLogic.test.jsx`  | `expected undefined to deeply equal { region: 'us', ... }`                            | lastPlayed not set in hard mode                      | Quick (10-15 min)  | P1       |
| BUG-009 | `tests/unit/utils/GameLogic.test.jsx`  | `expected true to be false` - taxonomic score calculation wrong                       | Hard mode feedback incorrect                         | Medium (20-30 min) | P1       |
| BUG-010 | `tests/unit/utils/GameLogic.test.jsx`  | `expected true to be false` - hasPlayedHardModeRegionDate wrong                       | Hard mode play tracking broken                       | Quick (10-15 min)  | P1       |
| BUG-011 | `tests/unit/utils/GameLogic.test.jsx`  | `expected true to be false` - hasCompletedNormalMode wrong                            | Normal mode completion tracking broken               | Quick (10-15 min)  | P1       |
| BUG-012 | `tests/unit/utils/GameLogic.test.jsx`  | `expected true to be false` - hasCompletedHardMode wrong                              | Hard mode completion tracking broken                 | Quick (10-15 min)  | P1       |

## Minor Bugs (Fix When Convenient)

| ID      | File                                   | Error Message                                                            | Impact                                          | Estimate           | Priority |
| ------- | -------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- | ------------------ | -------- |
| BUG-013 | `tests/integration/game-flow.test.jsx` | `should process multiple guesses and track stats correctly` (3 failures) | Integration test edge cases only                | Low (not critical) | P3       |
| BUG-014 | `tests/integration/game-flow.test.jsx` | `should handle game loss after max guesses`                              | Integration test edge cases only                | Low (not critical) | P3       |
| BUG-015 | `tests/integration/game-flow.test.jsx` | `should calculate performance summary correctly`                         | Integration test edge cases only                | Low (not critical) | P3       |
| BUG-016 | `tests/unit/utils/GameLogic.test.jsx`  | `expected [ { id: 'amerob', ... }, ... ] to include undefined`           | Edge case: different dates may return same bird | Low (edge case)    | P3       |
| BUG-017 | `tests/unit/utils/GameLogic.test.jsx`  | `expected undefined to be defined` in getHardModeGameState               | Edge case: hardModeGames initialization         | Low (edge case)    | P3       |

## Test Infrastructure Issues

| ID      | File                                   | Error Message                                                                | Impact                                   | Estimate          | Priority |
| ------- | -------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- | ----------------- | -------- |
| INF-001 | `tests/unit/utils/CacheUtils.test.jsx` | `TypeError: Cannot read properties of undefined (reading 'getRegistration')` | Service worker mock incomplete           | Quick (10-15 min) | P2       |
| INF-002 | `tests/unit/utils/CacheUtils.test.jsx` | `Failed to get service worker registration: Error: SW error`                 | Service worker error handling test noisy | Quick (5-10 min)  | P2       |
| INF-003 | `tests/unit/utils/CacheUtils.test.jsx` | `Failed to clear service worker cache: Error: Cache error`                   | Cache error handling test noisy          | Quick (5-10 min)  | P2       |

## Code Quality Issues

| ID       | File                                            | Error Message                                                        | Impact                   | Estimate         | Priority |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------- | ------------------------ | ---------------- | -------- |
| QLTY-001 | `tests/fixtures/integration-fixtures.jsx`       | `hashString` imported but never used                                 | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-002 | `tests/integration/audio-playback.test.jsx`     | `saveDeadAudioUrlsCache` imported but never used                     | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-003 | `tests/integration/audio-playback.test.jsx`     | `audioRef` assigned but never used (2 instances)                     | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-004 | `tests/integration/data-loading.test.jsx`       | `createMockDailyData` imported but never used                        | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-005 | `tests/integration/error-scenarios.test.jsx`    | `createTestRegionList` imported but never used                       | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-006 | `tests/integration/network-failures.test.jsx`   | `error` defined but never used (3 instances)                         | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-007 | `tests/integration/network-failures.test.jsx`   | Empty catch block at line 420                                        | Code quality issue       | Quick (2-5 min)  | P4       |
| QLTY-008 | `tests/integration/store-interactions.test.jsx` | `createTestGameState`, `createCompletedGame` imported but never used | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-009 | `tests/unit/utils/DailyBirdUtils.test.jsx`      | `errorResponse` assigned but never used                              | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-010 | `src/hooks/useAudioPlayer.js`                   | Unused eslint-disable directive                                      | Code cleanup             | Quick (1-2 min)  | P4       |
| QLTY-011 | `src/utils/SubregionUtils.jsx`                  | Fast refresh warning for non-component exports                       | Vite configuration issue | Quick (5-10 min) | P4       |
| QLTY-012 | `tests/integration/audio-playback.test.jsx:229` | Unused variable                                                      | Test file maintenance    | Quick (2-5 min)  | P4       |
| QLTY-013 | `tests/integration/audio-playback.test.jsx:240` | Unused variable                                                      | Test file maintenance    | Quick (2-5 min)  | P4       |

## Severity Definitions

- **Critical (P0):** Blocks core functionality (loading, playing, saving). Must fix before release.
  - Examples: Crashes, undefined errors, data corruption

- **Major (P1):** Affects important features but has workarounds. Fix in next release.
  - Examples: Incorrect state tracking, broken features, data inconsistencies

- **Minor (P3):** Edge cases, cosmetic issues. Fix when convenient.
  - Examples: Rare edge cases, non-critical test failures

- **Infrastructure (P2):** Test environment problems. Fix to improve test reliability.
  - Examples: Incomplete mocks, noisy error logging

- **Quality (P4):** Linting, code smells. Fix for maintainability.
  - Examples: Unused imports, empty blocks, warnings

## Summary Statistics

- **Critical Bugs:** 2 (5%)
- **Major Bugs:** 10 (27%)
- **Minor Bugs:** 5 (14%)
- **Infrastructure Issues:** 3 (8%)
- **Code Quality Issues:** 13 (35%)
- **Total:** 33 issues

## Root Cause Analysis

### Critical Issues

- **BUG-001, BUG-002:** Undefined values returned from stores cause crashes
  - Root cause: Stores returning undefined instead of default values
  - Fix: Add default values in store initialization

### Major Issues

- **BUG-003:** ETag header values include quotes that aren't being stripped
  - Root cause: Response header parsing not handling quoted values
  - Fix: Strip quotes from ETag values before storage

- **BUG-004:** Invalid JSON in localStorage causes parse errors
  - Root cause: No error handling for corrupted localStorage data
  - Fix: Add try-catch in StorageUtils with fallback to default

- **BUG-005 through BUG-012:** Store state inconsistencies
  - Root cause: Hybrid approach (GameLogic + stores) causes sync issues
  - Fix: Align test expectations with store behavior or fix store logic

### Minor Issues

- **BUG-013 through BUG-015:** Integration test edge cases
  - Root cause: Test cleanup and isolation issues
  - Fix: Improve test isolation and cleanup

- **BUG-016 through BUG-017:** Rare edge cases
  - Root cause: Edge case handling in deterministic selection
  - Fix: Add guard clauses for edge cases

### Infrastructure Issues

- **INF-001 through INF-003:** Service worker mocks incomplete
  - Root cause: jsdom doesn't fully implement service worker API
  - Fix: Improve mocks or use conditional tests

### Quality Issues

- **QLTY-001 through QLTY-013:** Unused code and imports
  - Root cause: Refactoring leftovers, incomplete cleanup
  - Fix: Remove unused imports and variables
