# Prioritized Bug List

**Created:** 2026-01-16
**Based on:** 06-02-SEVERITY-MATRIX.md

## Sprint 1: Critical Fixes (Plan 07-01)
**Estimated Time:** 30-45 minutes
**Success Criteria:** All critical tests passing, no crashes

### 1. [BUG-001] Fix getUserPerformanceSummary crash on undefined averageGuesses
- **File:** `src/utils/GameLogic.jsx`
- **Error:** `TypeError: Cannot read properties of undefined (reading 'toFixed')`
- **Line:** 713
- **Impact:** Stats summary crashes when averageGuesses is undefined
- **Root Cause:** Store returns undefined for averageGuesses instead of 0
- **Fix Options:**
  1. Add default value in getUserPerformanceSummary: `stats.averageGuesses || 0`
  2. Fix store initialization to set averageGuesses to 0
- **Recommended:** Option 1 (quick fix)
- **Estimate:** Quick (10-15 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should return correct summary for new game`
  - `should calculate correct stats after games`
  - `should include region breakdown`

### 2. [BUG-002] Fix getDailyBird returning undefined
- **File:** `src/utils/GameLogic.jsx`
- **Error:** `expected undefined to be defined`
- **Lines:** 316-325
- **Impact:** Daily bird selection fails silently
- **Root Cause:** hashString returns negative/zero for some inputs, causing invalid array index
- **Fix:** Add Math.abs() to seed calculation: `const index = Math.abs(seed) % birds.length;`
- **Estimate:** Quick (10-15 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should return a bird from the array`
  - `should be deterministic for same inputs`
  - `should return different birds for different dates`

## Sprint 2: Major Fixes (Plan 07-02)
**Estimated Time:** 60-90 minutes
**Success Criteria:** All major tests passing, state tracking working correctly

### 3. [BUG-003] Fix version info storage - ETag header quote mismatch
- **File:** `src/utils/versionUtils.js` (or wherever storeDataFileVersion is defined)
- **Error:** `expected "Wed, 15 Jan 2025 12:00:00 GMT"` but got `"\"Wed, 15 Jan 2025 12:00:00 GMT\""`
- **Impact:** Version tracking fails to store correct ETag values
- **Root Cause:** Response headers return quoted strings (ETag spec requires quotes)
- **Fix:** Strip quotes from ETag values: `etag?.replace(/^"|"$/g, '')`
- **Estimate:** Medium (20-30 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should store version info from response headers`
  - `should store version info and date`
  - `should store birds.json version info`

### 4. [BUG-004] Fix hasDateChanged crash on invalid localStorage data
- **File:** `src/utils/StorageUtils.jsx` OR `src/utils/CacheUtils.jsx`
- **Error:** `SyntaxError: Unexpected non-whitespace character after JSON at position 4`
- **Impact:** Date comparison crashes on invalid localStorage data
- **Root Cause:** No error handling for corrupted localStorage data
- **Fix:** Add try-catch in getStorage with fallback to default value
- **Estimate:** Quick (10-15 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should return true if date changed`
  - `should return false if date is same`

### 5. [BUG-005] Fix processGuess returning wrong bird ID
- **File:** `src/utils/GameLogic.jsx` OR `src/stores/normalGameStore.ts`
- **Error:** `expected 'barswa' to be 'amerob'` - guess stored with wrong ID
- **Impact:** Incorrect guess data stored, affects game state
- **Root Cause:** Store state sync issue - tests expect old GameLogic behavior
- **Fix Options:**
  1. Update GameLogic.processGuess to sync state properly
  2. Fix store processGuess action
  3. Update tests to match new store-based behavior
- **Recommended:** Investigate store vs GameLogic behavior first
- **Estimate:** Medium (20-30 min)
- **Dependencies:** Needs investigation
- **Tests Affected:**
  - `should process incorrect guess` (normal mode)
  - `should process incorrect guess in hard mode` (hard mode)

### 6. [BUG-006] Fix game completion status tracking
- **File:** `src/stores/normalGameStore.ts` OR `src/stores/hardModeStore.ts`
- **Error:** `expected false to be true` - completed/won status wrong
- **Impact:** Game completion tracking broken
- **Root Cause:** Store not setting completed=true after max guesses
- **Fix:** Ensure processGuess actions check maxGuesses and set completed
- **Estimate:** Medium (20-30 min)
- **Dependencies:** BUG-005 (related to state sync)
- **Tests Affected:**
  - `should complete game after max guesses` (normal mode)
  - `should complete game after max hard mode guesses (6)` (hard mode)

### 7. [BUG-007] Fix streak not resetting on loss
- **File:** `src/stores/normalGameStore.ts` OR `src/stores/hardModeStore.ts`
- **Error:** `expected 0 to be 1` - streak increments on loss
- **Impact:** Streak tracking broken
- **Root Cause:** Stats update logic doesn't reset streak on loss
- **Fix:** Ensure updateStats resets currentStreak to 0 when game.won === false
- **Estimate:** Quick (10-15 min)
- **Dependencies:** BUG-006 (completion tracking)
- **Tests Affected:**
  - `should reset streak on loss` (normal mode)
  - `should reset hard mode streak on loss` (hard mode)

### 8. [BUG-008] Fix lastPlayed not set in hard mode
- **File:** `src/stores/hardModeStore.ts`
- **Error:** `expected undefined to deeply equal { region: 'us', ... }`
- **Impact:** lastPlayed tracking missing in hard mode
- **Root Cause:** hardModeStore doesn't track lastPlayed
- **Fix:** Add lastPlayed field and update logic to hardModeStore
- **Estimate:** Quick (10-15 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should set lastPlayed with mode: hard`

### 9. [BUG-009] Fix taxonomic score calculation
- **File:** `src/utils/TaxonomyUtils.jsx` OR `src/stores/hardModeStore.ts`
- **Error:** `expected false to be true` - score calculation wrong
- **Impact:** Hard mode feedback incorrect
- **Root Cause:** Taxonomic comparison logic returning wrong values
- **Fix:** Debug compareTaxonomy function, ensure correct boolean logic
- **Estimate:** Medium (20-30 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should calculate taxonomic score correctly`

### 10. [BUG-010] Fix hasPlayedHardModeRegionDate incorrect true
- **File:** `src/utils/GameLogic.jsx` OR `src/stores/hardModeStore.ts`
- **Error:** Returns true for unplayed games
- **Impact:** Hard mode play tracking broken
- **Root Cause:** Function checking store.find() instead of specific key
- **Fix:** Check specific game key and verify guesses.length > 0
- **Estimate:** Quick (10-15 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should return false for unplayed hard mode game`

### 11. [BUG-011] Fix hasCompletedNormalMode incorrect true
- **File:** `src/utils/GameLogic.jsx` OR `src/stores/normalGameStore.ts`
- **Error:** Returns true for incomplete games
- **Impact:** Normal mode completion tracking broken
- **Root Cause:** Store returns games with guesses but completed=false
- **Fix:** Ensure check includes `completed === true` not just `guesses.length > 0`
- **Estimate:** Quick (10-15 min)
- **Dependencies:** None
- **Tests Affected:**
  - `should return false for incomplete normal mode game`

### 12. [BUG-012] Fix hasCompletedHardMode incorrect true
- **File:** `src/utils/GameLogic.jsx` OR `src/stores/hardModeStore.ts`
- **Error:** Returns true for incomplete games
- **Impact:** Hard mode completion tracking broken
- **Root Cause:** Same as BUG-011, but for hard mode
- **Fix:** Same as BUG-011 for hardModeStore
- **Estimate:** Quick (10-15 min)
- **Dependencies:** BUG-011 (same pattern)
- **Tests Affected:**
  - `should return false for incomplete hard mode game`

## Sprint 3: Minor Fixes (Plan 07-03)
**Estimated Time:** 30-45 minutes
**Success Criteria:** All minor tests passing, edge cases handled

### 13. [BUG-013] Fix integration test state persistence
- **File:** `tests/integration/game-flow.test.jsx`
- **Error:** `Game us-2025-01-15 not found` after creation
- **Impact:** Integration tests failing
- **Root Cause:** Test isolation issues - state not persisting between operations
- **Fix:** Improve test cleanup and store reset between tests
- **Estimate:** Low (not critical, can defer)
- **Dependencies:** Test infrastructure fixes (INF-001)
- **Tests Affected:**
  - `should process multiple guesses and track stats correctly`
  - `should handle game loss after max guesses`
  - `should calculate performance summary correctly`

### 14. [BUG-014] Fix deterministic bird selection edge case
- **File:** `src/utils/GameLogic.jsx`
- **Error:** `expected [ { id: 'amerob', ... }, ... ] to include undefined`
- **Impact:** Different dates may return same bird (rare edge case)
- **Root Cause:** Hash collision or insufficient seed variation
- **Fix:** Add date component to seed for more variation
- **Estimate:** Low (edge case)
- **Dependencies:** None
- **Tests Affected:**
  - `should return different birds for different dates`

### 15. [BUG-015] Fix hardModeGames initialization edge case
- **File:** `src/utils/GameLogic.jsx`
- **Error:** `expected undefined to be defined`
- **Impact:** Rare edge case when hardModeGames object is missing
- **Root Cause:** No guard clause for missing hardModeGames
- **Fix:** Add check: `if (!gameState.hardModeGames) gameState.hardModeGames = {};`
- **Estimate:** Low (edge case)
- **Dependencies:** None
- **Tests Affected:**
  - `should initialize hardModeGames object if missing`

## Sprint 4: Test Infrastructure & Quality (Plan 07-03)
**Estimated Time:** 30-45 minutes
**Success Criteria:** Clean test output, no lint errors

### 16. [INF-001] Fix service worker mock
- **File:** `tests/setup.js` OR test helper
- **Error:** `TypeError: Cannot read properties of undefined (reading 'getRegistration')`
- **Impact:** Service worker tests erroring (but passing)
- **Fix:** Improve navigator.serviceWorker mock in test setup
- **Estimate:** Quick (10-15 min)
- **Dependencies:** None

### 17-19. [INF-002, INF-003] Suppress expected error logs
- **File:** `tests/unit/utils/CacheUtils.test.jsx`
- **Error:** Error logging in tests for expected error conditions
- **Impact:** Test output noisy
- **Fix:** Spy on console.error and mock in error tests
- **Estimate:** Quick (5-10 min each)
- **Dependencies:** INF-001

### 20-32. [QLTY-001 through QLTY-013] Clean up linting errors
- **Files:** Multiple test files and src files
- **Error:** Unused imports, variables, empty blocks
- **Impact:** Code quality
- **Fix:** Remove unused imports and variables, add console log to empty catch
- **Estimate:** Quick (2-5 min each, ~30 min total)
- **Dependencies:** None

## Sprint 5: Documentation (Plan 07-03)
**Estimated Time:** 20-30 minutes
**Success Criteria:** Documentation complete and accurate

### 33. [DOC-001] Document RetryUtils usage patterns
- **Files:** `src/utils/RetryUtils.jsx`, AGENTS.md
- **Gap:** Missing examples for retryWithBackoff()
- **Content:** Add usage examples to AGENTS.md
- **Estimate:** Quick (10-15 min)

### 34. [DOC-002] Document StorageUtils API
- **Files:** `src/utils/StorageUtils.jsx`, AGENTS.md
- **Gap:** Missing examples for new utility functions
- **Content:** Add API documentation with examples
- **Estimate:** Quick (10-15 min)

### 35. [DOC-003] Document store patterns
- **Files:** `src/stores/*.ts`, AGENTS.md
- **Gap:** Missing usage examples for Zustand stores
- **Content:** Add store usage patterns and examples
- **Estimate:** Quick (10-15 min)

## Sprint 6: Final Validation (Plan 07-04)
**Estimated Time:** 20 minutes
**Success Criteria:** 100% test pass rate, clean build

### 36. Run full test suite
- **Command:** `npm test -- --run`
- **Success:** All 531 tests passing
- **Estimate:** 5 minutes

### 37. Run linting
- **Command:** `npm run lint`
- **Success:** No errors or warnings
- **Estimate:** 2 minutes

### 38. Run build
- **Command:** `npm run build`
- **Success:** Clean build with no errors
- **Estimate:** 2 minutes

## Summary

**Total Issues:** 38 (bugs + infrastructure + quality + documentation)
**Total Estimated Time:** 4-5 hours

**By Priority:**
- P0 (Critical): 2 issues, 30 min
- P1 (Major): 10 issues, 90 min
- P2 (Infrastructure): 3 issues, 30 min
- P3 (Minor): 5 issues, 45 min
- P4 (Quality): 13 issues, 30 min
- Documentation: 3 issues, 30 min
- Validation: 3 tasks, 10 min

**By Sprint:**
- Sprint 1 (Critical): 30-45 min
- Sprint 2 (Major): 60-90 min
- Sprint 3 (Minor): 30-45 min
- Sprint 4 (Infra + Quality): 60-75 min
- Sprint 5 (Documentation): 20-30 min
- Sprint 6 (Validation): 20 min

**Total Execution Time:** ~5 hours (including testing and validation)

## Notes

- **Fix Order:** Critical → Infrastructure → Major → Minor → Quality → Docs
- **Infrastructure First:** Fixing INF-001 (service worker mock) will improve test reliability for all other fixes
- **Batch Similar Fixes:** QLTY-001 through QLTY-013 can be done in one pass
- **Test After Each Sprint:** Run test suite after each sprint to verify fixes
- **Conservative Estimates:** Time estimates are conservative; actual time may be less
