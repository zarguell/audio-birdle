# Codebase Concerns

**Analysis Date:** 2026-01-15

## Tech Debt

**Hardcoded Secret Salt:**
- Issue: `SECRET_SALT = "birdle-salt-2025"` hardcoded in multiple files
- Files: `src/utils/DailyBirdUtils.jsx`, `scripts/generate-daily-birds.py`
- Why: Convenience for development
- Impact: Security vulnerability if salt is discovered (allows prediction of daily answers)
- Fix approach: Move to environment variable (`DAILY_BIRD_SALT`)

**Complex Cache Utils:**
- Issue: `src/utils/CacheUtils.jsx` is 299 lines with excessive try/catch blocks and complex version tracking
- Files: `src/utils/CacheUtils.jsx`
- Why: Evolved organically without refactoring
- Impact: Difficult to maintain, hard to debug
- Fix approach: Simplify caching logic, extract version tracking to separate module

**Large App Component:**
- Issue: `src/App.jsx` has multiple responsibilities (data loading, game state, audio, UI)
- Files: `src/App.jsx`
- Why: Component grew organically
- Impact: Hard to maintain, difficult to test
- Fix approach: Extract logic to custom hooks or separate utilities

**Duplicate Fetch Logic:**
- Issue: Similar retry patterns in multiple files
- Files: `src/utils/LoadGameData.jsx`, `src/utils/DailyBirdUtils.jsx`, `src/utils/CacheUtils.jsx`
- Why: Copy-paste driven development
- Impact: Inconsistent behavior, maintenance burden
- Fix approach: Create shared retry utility in separate module

## Known Bugs

**Python Import Errors:**
- Symptoms: Multiple Python scripts have import resolution errors
- Files: `scripts/ebird-region.py`, `scripts/ebird-taxonomy.py`, `scripts/generate-daily-birds.py`, `scripts/ebird-songdownload.py`
- Trigger: LSP analysis shows missing imports (dotenv, pandas, bs4, selenium)
- Workaround: Scripts may still run in production (LSP misconfiguration)
- Root cause: Python environment not properly configured for LSP
- Blocked by: None (functional but LSP warnings)

## Security Considerations

**Hardcoded Secret:**
- Risk: Daily bird answers can be predicted if salt is discovered
- Files: `src/utils/DailyBirdUtils.jsx`, `scripts/generate-daily-birds.py`
- Current mitigation: None (salt visible in source code)
- Recommendations: Move salt to environment variable, use different salt per environment (dev/staging/prod)

**Missing .env.example:**
- Risk: Developers don't know which environment variables are required
- Current mitigation: Documentation in README (but no template)
- Recommendations: Create `.env.example` with all required variables (EBIRD_API_KEY, DAILY_BIRD_SALT)

**Unvalidated API Access:**
- Risk: Scripts access `EBIRD_API_KEY` without validation
- Files: All Python scripts in `scripts/` directory
- Current mitigation: Scripts fail gracefully if key missing
- Recommendations: Add validation at startup, clear error messages

## Performance Bottlenecks

**Manual Audio Scraping:**
- Problem: `scripts/ebird-songdownload.py` requires 2-4 hours per region using Selenium
- File: `scripts/ebird-songdownload.py`
- Measurement: 2-4 hours per region for audio URL collection
- Cause: No official eBird API for audio downloads, must scrape website
- Improvement path: Investigate API-based audio URL fetching, contact eBird for API access

**Complex Caching Logic:**
- Problem: Excessive version tracking and try/catch blocks in cache utils
- File: `src/utils/CacheUtils.jsx` (299 lines)
- Measurement: Multiple nested try/catch blocks impact performance
- Cause: Over-engineered caching solution
- Improvement path: Simplify to basic TTL-based caching, reduce exception handling

**Full Data Regeneration:**
- Problem: Small data changes require full JSON regeneration
- Files: All Python scripts in `scripts/` directory
- Measurement: 10-30 minutes for full data regeneration
- Cause: Monolithic data generation scripts
- Improvement path: Implement incremental updates, only regenerate changed data

## Fragile Areas

**Selenium Browser Automation:**
- File: `scripts/ebird-songdownload.py`
- Why fragile: Browser automation breaks when website layout changes
- Common failures: Element selectors become invalid, timeout errors
- Safe modification: Use explicit waits, add fallback selectors, monitor for failures
- Test coverage: No tests for scraping logic

**Complex Game State Management:**
- File: `src/utils/GameLogic.jsx`
- Why fragile: Multiple state mutations spread across functions
- Common failures: State desync, lost updates
- Safe modification: Extract to state management library (Zustand/Redux)
- Test coverage: Good (31 tests), but integration testing limited

## Scaling Limits

**Manual Region Onboarding:**
- Current capacity: Limited by manual audio scraping effort
- Limit: Adding new regions requires 2-4 hours of Selenium scraping
- Symptoms at limit: Unable to expand to new regions quickly
- Scaling path: Investigate API-based audio fetching, automate scraping

**Static JSON Data Size:**
- Current capacity: ~10k bird records in single JSON file
- Limit: Browser memory and network transfer size for large datasets
- Symptoms at limit: Slow initial load, high memory usage
- Scaling path: Implement data pagination, lazy load by region

## Dependencies at Risk

**Selenium:**
- Risk: Fragile browser automation, maintenance burden
- Impact: Audio scraping breaks on website changes
- Migration plan: Investigate API-based audio fetching or alternative scraping methods

**Python LSP Configuration:**
- Risk: Multiple import errors in Python scripts
- Impact: Poor developer experience, confusing error messages
- Migration plan: Fix Python LSP configuration, add proper virtual environment detection

## Missing Critical Features

**Error Boundaries:**
- Problem: No React error boundaries for graceful failure handling
- Current workaround: Console error logging only
- Files: `src/App.jsx` (no error boundaries)
- Blocks: Users see white screen of death on component errors
- Implementation complexity: Low (add ErrorBoundary component)

**Incremental Data Updates:**
- Problem: Full data regeneration required for small changes
- Current workaround: Manual partial updates
- Blocks: Fast iteration on data pipeline improvements
- Implementation complexity: Medium (refactor scripts to support incremental updates)

**Integration Test Coverage:**
- Problem: Limited integration tests for data pipeline and end-to-end workflows
- Current workaround: Manual testing
- Files: `tests/integration/` (limited test files)
- Blocks: Confidence in data pipeline, regression detection
- Implementation complexity: Medium (add E2E test scenarios)

## Test Coverage Gaps

**Data Pipeline Integration:**
- What's not tested: End-to-end data generation from eBird API to JSON files
- Risk: Data pipeline could break silently
- Priority: High
- Difficulty to test: Need mocked eBird API or test environment

**Network Failure Scenarios:**
- What's not tested: App behavior when eBird API or JSON files are unavailable
- Risk: App fails without graceful degradation
- Priority: Medium
- Difficulty to test: Need to simulate network failures in test environment

**Edge Cases for Data Formats:**
- What's not tested: Malformed JSON, missing bird data fields, corrupt localStorage
- Risk: App crashes on bad data
- Priority: Medium
- Difficulty to test: Need comprehensive test fixtures for edge cases

---

*Concerns audit: 2026-01-15*
*Update as issues are fixed or new ones discovered*
