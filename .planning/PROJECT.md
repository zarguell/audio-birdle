# Audio-Birdle Refactor

## What This Is

A comprehensive refactor of the Audio-Birdle codebase to improve code quality, reduce complexity, and increase maintainability. The game functionality remains the same—we're making the code easier to work with for future development.

## Core Value

**Maintainable codebase that's easy to understand, modify, and extend.**

If everything else fails, developers must be able to quickly find where things live and make changes without breaking anything.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Daily bird challenge game with hash-based selection — existing
- ✓ Normal mode (4 guesses, multiple choice) — existing
- ✓ Hard mode (6 guesses, taxonomic hints, free-text input) — existing
- ✓ Practice mode (unlimited rounds) — existing
- ✓ Audio playback with dead URL tracking — existing
- ✓ Multi-region support — existing
- ✓ Statistics tracking (streaks, wins, averages) — existing
- ✓ Daily automated updates via GitHub Actions — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Refactor large files (App.jsx 1,103 lines, CacheUtils.jsx 299 lines) into smaller focused modules
- [ ] Eliminate duplicate patterns (retry logic, storage operations, hash implementation)
- [ ] Simplify state management (introduce state management library, reduce localStorage complexity)
- [ ] Improve code understandability (document complex logic like CacheUtils, add comments)
- [ ] Increase test coverage (add integration tests, improve edge case coverage)
- [ ] Fix issues discovered through testing (bugs found during test expansion)
- [ ] Refine solution based on testing results (iterative improvement)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Game mechanics changes** — Rules, win conditions, scoring logic work fine
- **UI/visual redesign** — Tailwind components stay as-is, no styling changes
- **Security: hardcoded secret salt** — User's threat model accepts this (client-side app, hash reversible)
- **Performance: audio scraping** — Manual Selenium scraping deferred to future work
- **Major new dependencies** — Keep the stack light, use existing patterns

## Context

**Current State:**
- Audio-Birdle is a fully functional bird identification game with 157 tests passing
- Codebase analysis identified technical debt in several areas
- Static client-side React app with Python data processing pipeline
- Deployed on Cloudflare Workers with daily automated updates

**Key Issues to Address:**
- **Large files:** App.jsx (1,103 lines) handles too many responsibilities; CacheUtils.jsx (299 lines) has excessive try/catch blocks and complex version tracking
- **Duplicate code:** Retry logic in LoadGameData, DailyBirdUtils, CacheUtils; hash implementation duplicated between Python and JavaScript; storage operations repeated across components
- **Complex state:** Nested game state in localStorage with manual migrations, no state management library
- **Missing tests:** Limited integration test coverage, insufficient edge case testing
- **Documentation gaps:** Complex modules like CacheUtils lack explanation of caching strategies

**Development Approach:**
Incremental refactoring with continuous validation. Each refactored area will be tested to ensure no regressions. Ship improvements incrementally rather than one massive refactor.

## Constraints

- **Tech Stack:** React 19.1.0, Vite 7.3.1, JavaScript/JSX (no TypeScript migration), Python 3.x for scripts
- **Backward Compatibility:** Must maintain state migrations, existing localStorage data must continue to work
- **Test Coverage:** All 157 existing tests must pass throughout refactor; new tests added for refactored code
- **No Breaking Changes:** Game mechanics, UI components, and user-facing behavior remain unchanged
- **Deployment:** Must continue to work on Cloudflare Workers with existing build pipeline

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Incremental refactor with continuous testing | Minimize risk of breaking working code | — Pending |
| Introduce state management library (likely Zustand or Redux) | Current localStorage state is complex and error-prone | — Pending |
| Extract shared utilities (retry, storage) before refactoring consumers | Avoid duplicating fixes across files | — Pending |
| Add integration tests before refactoring complex areas | Ensure refactoring doesn't break behavior | — Pending |

---
*Last updated: 2026-01-15 after initialization*
