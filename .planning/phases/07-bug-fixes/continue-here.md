---
phase: 07-bug-fixes
task: 1
total_tasks: 4
status: in_progress
last_updated: 2026-01-16 16:30
---

<current_state>
Executing Sprint 1: Critical Fixes (BUG-001, BUG-002)

**Test Results Before Fixes:**
- GameLogic.test.jsx: 503/531 passing (94.7%)
- Total failures: 28

**Test Results After Fixes:**
- GameLogic.test.jsx: 39/51 tests passing (76.5%)
- Overall improvement: +11 tests passing
- Critical fixes: BUG-002 ✅ complete, BUG-001 partially complete

**What Got Fixed:**
1. BUG-002: `getDailyBird` returning undefined
   - File: src/utils/GameLogic.jsx:316-325
   - Issue: hashString returns hex string, but code tried to use as integer directly
   - Fix: `const seed = parseInt(hashString(...), 16)` before calculating index
   - Result: All 4 getDailyBird tests now passing ✅

2. BUG-001: `getUserPerformanceSummary` crash on undefined averageGuesses
   - File: src/utils/GameLogic.jsx:707-723
   - Issue: stats.averageGuesses can be undefined, causing .toFixed() crash
   - Fix: Added default values `(stats.averageGuesses || 0).toFixed(1)` for both stats and regionStats
   - Result: 2/3 getUserPerformanceSummary tests passing (was 0/3) ⚠️

3. Infrastructure: Store reset between tests
   - File: tests/unit/utils/GameLogic.test.jsx
   - Added: beforeEach hook to reset useNormalGameStore and useHardModeStore
   - Result: Prevents test pollution, more reliable test results ✅

**What's Still Broken:**
1. `should calculate correct stats after games` - averageGuesses returns 0 instead of 3.0
   - Expected: After 2 games (win in 2 guesses, loss in 4), averageGuesses = 3.0
   - Actual: averageGuesses = 0.0
   - Root cause: Store stats update not being read correctly OR store action not calculating averageGuesses
   - Line: tests/unit/utils/GameLogic.test.jsx:295

2. All 12 hard mode tests failing - "Hard mode game not found"
   - Pattern: processHardModeGuess doesn't initialize games in store
   - Solution: Apply same initialization pattern as processGuess
   - Affected functions: processHardModeGuess, getHardModeGameState
   - Files: src/utils/GameLogic.jsx (hard mode section)
</current_state>

<completed_work>

- Task 1: Fix BUG-002 (getDailyBird undefined) - ✅ Complete
- Task 2: Fix BUG-001 (getUserPerformanceSummary crash) - ⚠️ Partial
  - Added default values for undefined averageGuesses ✅
  - Added optional gameState parameter for backward compatibility ✅
  - Added store reset between tests ✅
  - ❌ REMAINING: averageGuesses calculation issue (returns 0 instead of 3.0)
</completed_work>

<remaining_work>

- Task 2: Complete BUG-001 fix - averageGuesses calculation
  - Debug why store's updateStats doesn't update averageGuesses
  - Verify processGuess is calling store action correctly
  - Check if store is persisting stats correctly
  - Estimated: 10-15 minutes

- Task 3: Fix hard mode initialization (apply same pattern as processGuess)
  - Add store initialization check to processHardModeGuess
  - Add store initialization check to getHardModeGameState
  - Test all 12 failing hard mode tests
  - Estimated: 15-20 minutes

- Task 4: Not started (Plan 07-02: Infrastructure fixes)
</remaining_work>

<decisions_made>

- **Hybrid GameLogic API pattern established**: processGuess syncs gameState to store first (if provided), then uses store action, returns updated state from store
  - Rationale: Maintains backward compatibility with existing tests while making stores the source of truth
  - Pattern: Check gameState.dailyGames[key] → sync if exists; otherwise check store.getDailyGame(key) → initialize if missing

- **Store reset between tests**: Added beforeEach to both normal and hard mode stores
  - Rationale: Prevents state pollution from test to test
  - Implementation: `useNormalGameStore.getState().reset()` and `useHardModeStore.getState().reset()`
  - Files: tests/unit/utils/GameLogic.test.jsx

- **Default value strategy for undefined stats**: Use `|| 0` before calling .toFixed()
  - Rationale: Prevents "Cannot read properties of undefined" errors
  - Pattern: `(stats.averageGuesses || 0).toFixed(1)` for both global and region stats

</decisions_made>

<blockers>
- **averageGuesses calculation**: Store returns 0 instead of calculating average
  - Status: Investigating
  - Suspected cause: Either store.updateStats not called, or calculation wrong, or not reading from store correctly
  - Impact: Blocks completion of BUG-001 fix
  - Next step: Add console.log to trace store action execution and verify updateStats is called

- **Token limit**: ~112K/200K tokens used, need to hand off before hitting limit
  - Status: Non-blocking but approaching
  - Impact: Risk of incomplete session write-up if limit reached mid-task
  - Action: Create this handoff now
</blockers>

<context>
**Mental State and Approach:**

The hybrid state/store approach in GameLogic.jsx is creating complexity. The pattern that works:

```javascript
export const processGuess = (gameState, region, date, guessedBirdId, correctBirdId) => {
  const key = createRegionDateKey(region, date);
  const isCorrect = guessedBirdId === correctBirdId;

  // For backward compatibility with tests, sync provided state to store first
  if (gameState && gameState.dailyGames && gameState.dailyGames[key]) {
    useNormalGameStore.getState().setDailyGame(key, gameState.dailyGames[key]);
  } else {
    // Check if game exists in store, if not initialize it
    const existingGame = useNormalGameStore.getState().getDailyGame(key);
    if (!existingGame) {
      const initialGame = createInitialDailyGameState(region, date);
      useNormalGameStore.getState().setDailyGame(key, initialGame);
    }
  }

  // Use store's processGuess action
  useNormalGameStore.getState().processGuess(key, {
    birdId: guessedBirdId,
    correct: isCorrect,
    timestamp: Date.now(),
  });

  // Return complete state object for backward compatibility
  const updatedGame = useNormalGameStore.getState().getDailyGame(key);
  const storeStats = useNormalGameStore.getState().stats;

  return {
    dailyGames: {
      [key]: updatedGame
    },
    stats: storeStats,
    version: 2
  };
};
```

**Key insight**: The function always reads from the store at the end, regardless of what was passed in. This is correct - stores are the source of truth.

**Next steps when resuming:**
1. Debug why `storeStats.averageGuesses` is 0 after games complete
2. Apply same initialization pattern to `processHardModeGuess`
3. Run full GameLogic test suite to verify all fixes
4. Continue to Sprint 2 (Infrastructure fixes) if Sprint 1 completes

**Test coverage context:**
- Before: 503/531 passing (94.7%)
- After: 39/51 GameLogic tests passing, but need to account for hard mode tests
- Target for Phase 7: >97% pass rate (515/531+)
</context>

<next_action>
When resuming, start by debugging averageGuesses calculation:

1. Add console.log to trace store action:
   ```javascript
   console.log('Before store action:', useNormalGameStore.getState().stats);
   useNormalGameStore.getState().processGuess(key, {...});
   console.log('After store action:', useNormalGameStore.getState().stats);
   ```

2. Run the failing test: `npm test -- tests/unit/utils/GameLogic.test.jsx -t "should calculate correct stats after games" --run`

3. Observe if updateStats is being called and what values it receives

4. If updateStats is correct but not persisting, check store persistence configuration

After fixing averageGuesses, apply the same initialization pattern from processGuess to processHardModeGuess to fix all 12 hard mode test failures.
</next_action>
