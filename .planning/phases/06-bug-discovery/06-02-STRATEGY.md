# Phase 7 Fix Strategy Summary

**Created:** 2026-01-16
**Based on:** 06-02-SEVERITY-MATRIX.md and 06-02-BUG-LIST.md

## Overview

**Total Issues:** 38 (bugs + infrastructure + quality + documentation)
**Total Estimated Time:** 4-5 hours
**Execution Phases:** 6 sprints

## Fix Strategy

### Key Principles

1. **Critical First:** Fix P0 issues immediately to prevent crashes
2. **Infrastructure Early:** Fix test mocking to improve test reliability
3. **Batch Similar Issues:** Group related fixes for efficiency
4. **Test After Each Sprint:** Verify fixes with full test suite
5. **Conservative Estimates:** Better to overestimate than under

## Sprint Breakdown

---

## Sprint 1: Critical Fixes (Plan 07-01)
**File:** `.planning/phases/06-bug-discovery/07-01-PLAN.md`
**Estimated Time:** 30-45 minutes
**Issues:** 2 critical bugs
**Success Criteria:** All critical tests passing, no crashes

### Bug-001: Fix getUserPerformanceSummary crash
- **File:** `src/utils/GameLogic.jsx:713`
- **Fix:** Add default value for averageGuesses
- **Code:**
  ```javascript
  averageGuesses: (stats.averageGuesses || 0).toFixed(1),
  ```
- **Test After:** Run `npm test -- tests/unit/utils/GameLogic.test.jsx`

### Bug-002: Fix getDailyBird returning undefined
- **File:** `src/utils/GameLogic.jsx:323`
- **Fix:** Add Math.abs() to seed calculation
- **Code:**
  ```javascript
  const index = Math.abs(seed) % birds.length;
  ```
- **Test After:** Run `npm test -- tests/unit/utils/GameLogic.test.jsx`

### Validation
- Run full test suite: `npm test -- --run`
- Expected result: 18 fewer failures (25 → 7)
- Time: 5 minutes

---

## Sprint 2: Infrastructure Fixes (Plan 07-02)
**File:** `.planning/phases/06-bug-discovery/07-02-PLAN.md`
**Estimated Time:** 30-45 minutes
**Issues:** 3 infrastructure issues
**Success Criteria:** Improved test reliability, clean test output

### INF-001: Fix service worker mock
- **File:** `tests/setup.js`
- **Fix:** Add complete service worker mock
- **Code:**
  ```javascript
  global.navigator.serviceWorker = {
    getRegistration: vi.fn().mockResolvedValue(null),
    ready: Promise.resolve(null),
  };
  ```
- **Test After:** Run CacheUtils tests

### INF-002, INF-003: Suppress expected error logs
- **File:** `tests/unit/utils/CacheUtils.test.jsx`
- **Fix:** Spy on console.error in error tests
- **Code:**
  ```javascript
  const errorSpy = vi.spyOn(console, 'error');
  // ... test code ...
  errorSpy.mockRestore();
  ```
- **Test After:** Run CacheUtils tests

### Validation
- Run CacheUtils tests: `npm test -- tests/unit/utils/CacheUtils.test.jsx`
- Expected result: Cleaner test output
- Time: 2 minutes

---

## Sprint 3: Major Fixes Part 1 (Plan 07-02)
**Estimated Time:** 30-45 minutes
**Issues:** 4 major bugs
**Success Criteria:** Version tracking and storage working correctly

### BUG-003: Fix ETag header quote mismatch
- **File:** `src/utils/versionUtils.js` (need to locate storeDataFileVersion)
- **Fix:** Strip quotes from ETag values
- **Code:**
  ```javascript
  const etag = response.headers.get('ETag')?.replace(/^"|"$/g, '');
  ```
- **Test After:** Run CacheUtils tests

### BUG-004: Fix hasDateChanged crash on invalid data
- **File:** `src/utils/StorageUtils.jsx`
- **Fix:** Add try-catch in getStorage
- **Code:**
  ```javascript
  export const getStorage = (key, defaultValue = null) => {
    if (!isStorageAvailable()) {
      return defaultValue;
    }
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return defaultValue;
    }
  };
  ```
- **Test After:** Run CacheUtils tests

### BUG-007: Fix streak not resetting on loss
- **File:** `src/stores/normalGameStore.ts` OR `src/stores/hardModeStore.ts`
- **Fix:** Ensure updateStats resets streak on loss
- **Test After:** Run GameLogic tests

### BUG-008: Fix lastPlayed not set in hard mode
- **File:** `src/stores/hardModeStore.ts`
- **Fix:** Add lastPlayed field and update logic
- **Test After:** Run GameLogic tests

### Validation
- Run affected test files
- Expected result: 4-6 fewer failures
- Time: 5 minutes

---

## Sprint 4: Major Fixes Part 2 (Plan 07-02)
**Estimated Time:** 45-60 minutes
**Issues:** 6 major bugs
**Success Criteria:** State tracking and completion working correctly

### BUG-005: Fix processGuess returning wrong bird ID
- **File:** `src/utils/GameLogic.jsx` OR `src/stores/normalGameStore.ts`
- **Investigation:** Check store state sync
- **Fix:** Align test expectations with store behavior
- **Test After:** Run GameLogic tests

### BUG-006: Fix game completion status tracking
- **File:** `src/stores/normalGameStore.ts` OR `src/stores/hardModeStore.ts`
- **Fix:** Ensure completed=true after max guesses
- **Test After:** Run GameLogic tests

### BUG-009: Fix taxonomic score calculation
- **File:** `src/utils/TaxonomyUtils.jsx`
- **Investigation:** Debug compareTaxonomy function
- **Fix:** Correct boolean logic
- **Test After:** Run GameLogic tests

### BUG-010, BUG-011, BUG-012: Fix play/completion tracking
- **Files:** `src/utils/GameLogic.jsx`, `src/stores/*.ts`
- **Fix:** Ensure correct boolean checks
- **Test After:** Run GameLogic tests

### Validation
- Run full test suite: `npm test -- --run`
- Expected result: 10-12 fewer failures (7 → -5)
- Time: 5 minutes

---

## Sprint 5: Code Quality (Plan 07-03)
**Estimated Time:** 30-45 minutes
**Issues:** 13 code quality issues
**Success Criteria:** Clean linting, no warnings

### Batch cleanup: Remove unused imports and variables
- **Files:** 6 test files + 1 src file
- **Pattern:** ESLint unused import/variable errors
- **Fix:**
  - Remove unused imports
  - Remove unused variables
  - Add console.log to empty catch blocks
- **Commands:**
  ```bash
  npm run lint
  # Fix each error manually
  ```
- **Test After:** Run linting again

### Validation
- Run linting: `npm run lint`
- Expected result: 0 errors, 0 warnings
- Time: 2 minutes

---

## Sprint 6: Minor Fixes & Integration (Plan 07-03)
**Estimated Time:** 30-45 minutes
**Issues:** 5 minor bugs
**Success Criteria:** All tests passing, integration tests working

### BUG-013: Fix integration test state persistence
- **File:** `tests/integration/game-flow.test.jsx`
- **Fix:** Improve test isolation and cleanup
- **Test After:** Run integration tests

### BUG-014: Fix deterministic bird selection edge case
- **File:** `src/utils/GameLogic.jsx`
- **Fix:** Add date component to seed
- **Test After:** Run GameLogic tests

### BUG-015: Fix hardModeGames initialization edge case
- **File:** `src/utils/GameLogic.jsx`
- **Fix:** Add guard clause
- **Test After:** Run GameLogic tests

### Validation
- Run full test suite: `npm test -- --run`
- Expected result: 5 fewer failures (all passing)
- Time: 5 minutes

---

## Sprint 7: Documentation (Plan 07-03)
**File:** `.planning/phases/06-bug-discovery/07-03-DOCS-PLAN.md`
**Estimated Time:** 45 minutes
**Issues:** 8 documentation gaps
**Success Criteria:** Core utility documentation complete

### Core Utilities (High Priority)
1. DOC-001: RetryUtils examples (10-15 min)
2. DOC-002: StorageUtils API (10-15 min)
3. DOC-003: Zustand store patterns (10-15 min)

### Updates to AGENTS.md
- Add usage examples for each utility
- Add API reference sections
- Include code snippets

### Validation
- Review AGENTS.md for completeness
- Time: 5 minutes

---

## Sprint 8: Final Validation (Plan 07-04)
**File:** `.planning/phases/06-bug-discovery/07-04-PLAN.md`
**Estimated Time:** 20 minutes
**Success Criteria:** 100% test pass rate, clean build

### Full Test Suite
```bash
npm test -- --run
```
- **Success:** All 531 tests passing
- **Failures:** 0
- **Time:** 5 minutes

### Linting
```bash
npm run lint
```
- **Success:** No errors or warnings
- **Time:** 2 minutes

### Build
```bash
npm run build
```
- **Success:** Clean build with no errors
- **Time:** 2 minutes

### Manual Verification
- Open dev server
- Play a full game
- Verify all features work
- **Time:** 5 minutes

---

## Time Budget

| Sprint | Issues | Estimate | Cumulative |
|--------|---------|-----------|------------|
| Sprint 1: Critical | 2 | 45 min | 0:45 |
| Sprint 2: Infrastructure | 3 | 45 min | 1:30 |
| Sprint 3: Major Part 1 | 4 | 45 min | 2:15 |
| Sprint 4: Major Part 2 | 6 | 60 min | 3:15 |
| Sprint 5: Quality | 13 | 45 min | 4:00 |
| Sprint 6: Minor + Integration | 5 | 45 min | 4:45 |
| Sprint 7: Documentation | 8 | 45 min | 5:30 |
| Sprint 8: Validation | 4 | 20 min | 5:50 |
| **Total** | **41** | **5:50** | **5:50** |

**Buffer Time:** 10-20 minutes (total ~6 hours)

## Risk Mitigation

### Risk 1: Store State Sync Issues
- **Risk:** BUG-005 is complex, may take longer than estimated
- **Mitigation:** Investigate first, create fix strategy before coding
- **Fallback:** Focus on test fixes if store fix is too complex

### Risk 2: Integration Tests Unreliable
- **Risk:** BUG-013 may be difficult to fix cleanly
- **Mitigation:** Accept some integration test failures if core functionality works
- **Fallback:** Document known issues and defer to future sprint

### Risk 3: Time Overrun
- **Risk:** Complex bugs may exceed estimates
- **Mitigation:** Prioritize critical + major fixes first
- **Fallback:** Defer minor bugs and documentation to Phase 8

## Success Metrics

### Phase 7 Success Criteria
- [ ] All P0 (critical) bugs fixed
- [ ] All P1 (major) bugs fixed
- [ ] All P2 (infrastructure) issues resolved
- [ ] Test pass rate ≥ 98% (≥520/531 tests)
- [ ] Linting: 0 errors, 0 warnings
- [ ] Build: Clean with no errors
- [ ] Core functionality verified manually

### Acceptable Trade-offs
- Minor bugs (P3) can be deferred if time-constrained
- Documentation can be partial (core utilities documented)
- Integration tests can have known issues if core tests pass

## Next Steps

1. **Execute Plan 07-01:** Fix critical bugs (BUG-001, BUG-002)
2. **Execute Plan 07-02:** Fix infrastructure and major bugs
3. **Execute Plan 07-03:** Fix minor bugs, quality issues, documentation
4. **Execute Plan 07-04:** Final validation and deployment

## Notes

- **Parallel Execution:** Some sprints can be done in parallel (e.g., documentation while tests run)
- **Incremental Testing:** Test after each fix, not just after each sprint
- **Documentation First:** Documenting while fresh in mind is more efficient
- **Conservative Estimates:** Time includes testing and validation
