# Phase 6 Quick Reference

**Status:** 📋 Planned (2026-01-16)
**Estimated Duration:** ~100 minutes (3 plans)
**Goal:** Discover and categorize bugs for Phase 7 fixes

## Phase 6 Plans at a Glance

| Plan | Duration | Objective | Deliverables |
|------|----------|-----------|--------------|
| 06-01 | ~30 min | Run full test suite | 06-01-FINDINGS.md |
| 06-02 | ~40 min | Categorize issues | Severity matrix, bug list, strategy |
| 06-03 | ~30 min | Create bug tracking | Bug tracker, verification checklist |

## Execution Order

```
06-01 (Run Tests) → 06-02 (Categorize) → 06-03 (Track Bugs) → Phase 7 (Fix Bugs)
```

## Quick Start: Plan 06-01

**Commands to run:**
```bash
# JavaScript tests with coverage
npm run test:coverage

# If coverage fails, run tests without coverage
npm test -- tests/unit/ tests/integration/

# Python tests
pytest tests/ -v

# Linting and build
npm run lint
npm run build
```

**What to collect:**
- Total test counts (passing/failing)
- Error messages for each failure
- Coverage percentages (if available)
- Linting errors and warnings
- Build output

**Output:** Create `06-01-FINDINGS.md` with all results

## Known Test Failures (From Phase 5)

**Total:** 24 known failures

| Category | Count | Files | Priority |
|----------|-------|-------|----------|
| Integration Tests | 3 | game-flow.test.jsx | Low |
| GameLogic Tests | 15 | GameLogic.test.jsx | Low |
| AudioUtils Tests | 3 | AudioUtils.test.jsx | Medium |
| DailyBirdUtils Tests | 3 | DailyBirdUtils.test.jsx | High |

## Quick Start: Plan 06-02

**Categories to use:**
1. **Critical** - Breaks core functionality (data loading, game play)
2. **Major** - Important features affected (has workarounds)
3. **Minor** - Edge cases, cosmetic issues
4. **Infrastructure** - Test environment, mocking
5. **Quality** - Linting, code smells

**Deliverables:**
- `06-02-SEVERITY-MATRIX.md` - Bugs categorized by severity
- `06-02-BUG-LIST.md` - Prioritized bug list
- `06-02-STRATEGY.md` - Phase 7 strategy

## Quick Start: Plan 06-03

**What to create:**
- `06-03-BUG-TRACKER.md` - Track all bugs with status
- `06-03-VERIFICATION.md` - Phase 7 verification checklist
- `06-03-WORKFLOW.md` - Bug fix process documentation

**Status codes:**
- 🔴 Open - Discovered, not assigned
- 🟡 Assigned - Assigned to Phase 7 plan
- 🟢 In Progress - Currently being fixed
- ✅ Fixed - Fix implemented, awaiting verification
- ⚠️ Verified - Fix verified, tests passing
- ❌ Deferred - Deferred to future phase

## Phase 7 Plan Assignments

**Plan 07-01 (Critical Fixes):**
- HTTP error handling in DailyBirdUtils
- Data loading bugs
- Core game functionality issues

**Plan 07-02 (Major + Minor Fixes):**
- localStorage mocking issues
- GameLogic edge cases
- Integration test failures

**Plan 07-03 (Documentation + Quality):**
- Utility usage documentation (RetryUtils, StorageUtils, HashUtils)
- Code quality issues
- Linting cleanup

**Plan 07-04 (Final Validation):**
- Full test suite verification
- Build verification
- Manual game flow testing

## Success Criteria

Phase 6 is complete when:
- ✅ All test suites executed (JS unit/integration, Python)
- ✅ All failures categorized by severity
- ✅ Prioritized bug list created
- ✅ Bug tracking system in place
- ✅ Verification checklist ready
- ✅ Fix workflow documented
- ✅ Ready to execute Phase 7

## Expected Outcomes

**Test Results:**
- Current: 503/531 passing (94.7%)
- Known failures: 24 tests
- Document all failures with specific error messages

**Bug Categorization:**
- Critical: 3-6 bugs (data loading, HTTP errors)
- Major: 3-6 bugs (test infrastructure)
- Minor: 8-12 bugs (edge cases)
- Documentation: 5-8 gaps

**Phase 7 Ready:**
- All bugs assigned to specific plans
- Effort estimates for each bug
- Clear verification criteria
- Systematic tracking approach

## Files to Create

**Plan 06-01:**
- `06-01-FINDINGS.md` - Test results

**Plan 06-02:**
- `06-02-SEVERITY-MATRIX.md` - Severity categorization
- `06-02-BUG-LIST.md` - Prioritized bug list
- `06-02-STRATEGY.md` - Fix strategy

**Plan 06-03:**
- `06-03-BUG-TRACKER.md` - Bug tracking spreadsheet
- `06-03-VERIFICATION.md` - Verification checklist
- `06-03-WORKFLOW.md` - Fix process documentation

**Summary:**
- `SUMMARY.md` - Phase 6 overview (already created)

## Time Tracking

Track time spent on each plan for velocity metrics:

| Plan | Estimate | Actual | Notes |
|------|----------|--------|-------|
| 06-01 | 30 min | ___ | ___ |
| 06-02 | 40 min | ___ | ___ |
| 06-03 | 30 min | ___ | ___ |
| **Total** | **100 min** | **___** | **___** |

## Next Steps After Phase 6

1. **Review bug tracker** - Ensure all issues are tracked
2. **Prioritize critical bugs** - Start Phase 7 with highest impact fixes
3. **Execute Phase 7** - Systematic bug fixing approach
4. **Track progress** - Update bug tracker as fixes are implemented
5. **Verify fixes** - Use verification checklist after each Phase 7 plan

## Commands Reference

```bash
# Run specific test file
npm test -- tests/unit/utils/DailyBirdUtils.test.jsx

# Run integration tests
npm run test:integration

# Run Python tests
pytest tests/ -v

# Run specific Python test
pytest tests/test_generate_daily_birds.py -v

# Linting
npm run lint

# Build
npm run build

# Preview build
npm run preview
```

## Tips for Success

1. **Document error messages precisely** - Copy exact error text for debugging
2. **Categorize by user impact** - Critical = blocks usage, Minor = edge cases
3. **Estimate conservatively** - Better to overestimate than under
4. **Fix infrastructure first** - Improve test reliability before code fixes
5. **Use systematic tracking** - Update bug tracker after every fix
6. **Verify no regressions** - Run full test suite after each fix
7. **Document decisions** - Note why bugs are categorized certain ways

## Phase 6 Success Metrics

- ✅ Test execution: 100% (all test suites run)
- ✅ Bug categorization: 100% (all failures categorized)
- ✅ Bug tracking: 100% (all bugs in tracker)
- ✅ Documentation: 100% (all deliverables created)
- ✅ Ready for Phase 7: Yes

---

**Phase 6 Status:** 📋 Planned (3/3 plans created)
**Ready for execution:** Yes
**Next step:** Execute Plan 06-01 (Run Full Test Suite)
