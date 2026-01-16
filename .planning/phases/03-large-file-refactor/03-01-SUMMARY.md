# Phase 3, Plan 1 Summary

**Analysis complete: App.jsx and CacheUtils.jsx refactoring plan documented**

## Accomplishments

- Analyzed App.jsx (797 lines) and documented all responsibilities
- Analyzed CacheUtils.jsx (184 lines) and identified optimization opportunities
- Created detailed extraction plan with dependency graph
- Documented test strategy for refactored code

## Files Created/Modified

- `.planning/phases/03-large-file-refactor/03-01-ANALYSIS.md` - Complete analysis document
- No source code modified (analysis phase)

## Decisions Made

- **Extraction order:** Custom hooks first, then leaf components, then GameView sub-components, then GameView, finally useGameNavigation
- **File structure:** New `src/components/` and expanded `src/hooks/` directories
- **Testing approach:** Individual unit tests for each module + integration tests for App.jsx
- **Test coverage targets:** 80% overall, with hooks at 85-90% and components at 80-95%

## Issues Encountered

None (analysis phase).

## Key Findings

### App.jsx Analysis

- **Monolithic component:** 797 lines with 5 render functions
- **State:** Only 3 local state variables (selectedRegion, lastPlayedMode, currentView)
- **Render functions:** ~612 lines (77% of file), with `renderGame` being largest at 271 lines
- **Extractable responsibilities:** 5 custom hooks, 9 components
- **Complexity:** High - mixed concerns (view routing, state management, migration, data fetching)

### CacheUtils.jsx Analysis

- **Well-organized:** 184 lines with clear separation of concerns
- **Repetitive patterns:** 3 similar version checking functions that could be consolidated
- **Documentation:** Excellent (9/10 score)
- **Testing gap:** Currently 0% test coverage (no tests exist)
- **Optimization opportunities:** Consolidate version checking, extract refresh pattern, add error recovery

### Extraction Plan

- **Phase 1:** Extract 5 custom hooks (usePersistence, useMigration, useShareResult, useGameInitialization, useGameNavigation)
- **Phase 2:** Extract 4 leaf components (RegionSelector, ModeSelector, StatsView, SettingsView)
- **Phase 3:** Extract 4 GameView sub-components (AudioPlayerSection, GuessesList, AnswerChoices, GameCompleted)
- **Phase 4:** Extract GameView component
- **Expected reduction:** ~600 lines removed from App.jsx (from 797 to ~150 lines)

### Test Strategy

- **18 new test files** to create
- **2,500 estimated lines** of test code
- **Coverage targets:** 80% overall, with individual module targets of 70-95%
- **Mocking strategy:** Comprehensive mocking of stores, localStorage, API calls, audio elements
- **Test utilities:** Create shared fixtures and utilities for consistent testing

## Risk Assessment

### High Risk

- `useGameNavigation` - Changes core view routing logic
- `GameView` - Largest component (271 lines)

### Medium Risk

- `useGameInitialization` - Interacts with Zustand store
- `SettingsView` - Depends on multiple state sources
- `AudioPlayerSection` - Complex audio state management

### Low Risk

- `RegionSelector` - Simple UI component
- `ModeSelector` - Pure presentational component
- `StatsView` - Read-only display

## Metrics

| Metric                  | Value        |
| ----------------------- | ------------ |
| App.jsx current size    | 797 lines    |
| App.jsx target size     | ~150 lines   |
| Lines to extract        | ~600 lines   |
| CacheUtils current size | 184 lines    |
| CacheUtils target size  | ~150 lines   |
| New test files          | 18 files     |
| New test lines          | ~2,500 lines |
| Target coverage         | 80% overall  |

## Next Step

**Plan 03-02** — Extract custom hooks from App.jsx

This plan will involve:

1. Creating test fixtures and utilities
2. Writing tests for each custom hook BEFORE extracting
3. Extracting hooks in this order: useMigration → usePersistence → useShareResult → useGameInitialization → useGameNavigation
4. Running full test suite after each extraction
5. Updating App.jsx to use new hooks
