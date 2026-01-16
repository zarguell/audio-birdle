# Phase 3: Large File Refactor

**Status**: 📋 Planned
**Started**: 2026-01-16
**Completed**: TBD

## Overview

Break down App.jsx (796 lines) and CacheUtils.jsx (183 lines) into focused, maintainable modules.

## Goals

1. Reduce App.jsx from 796 lines to ≤200 lines
2. Extract custom hooks for business logic
3. Extract view components for UI rendering
4. Optimize CacheUtils.jsx structure
5. Maintain 100% backward compatibility
6. Ensure all 157 tests continue to pass

## Plans

| Plan | Description | Status |
|------|-------------|--------|
| 03-01 | Analyze App.jsx and CacheUtils.jsx responsibilities | 📋 Planned |
| 03-02 | Extract custom hooks from App.jsx | 📋 Planned |
| 03-03 | Extract view components from App.jsx | 📋 Planned |
| 03-04 | Simplify CacheUtils.jsx | 📋 Planned |
| 03-05 | Update imports, tests, and validation | 📋 Planned |

## Deliverables

### Custom Hooks (5 new)
- `usePersistence` - Region and mode persistence
- `useGameNavigation` - View routing state
- `useGameInitialization` - Game creation on mount
- `useShareResult` - Share functionality
- `useMigration` - Zustand store migration

### Components (5 new)
- `RegionSelector` - Region selection UI
- `ModeSelector` - Game mode selection UI
- `StatsView` - Statistics display
- `SettingsView` - Settings menu
- `GameView` - Main game view (container)

### Optimized Files
- `App.jsx` - Reduced to ≤200 lines (routing + composition)
- `CacheUtils.jsx` - Improved documentation and organization

## Expected Outcomes

### File Structure Changes

**Before**:
```
src/
├── App.jsx (796 lines)
├── utils/
│   └── CacheUtils.jsx (183 lines)
└── hooks/
    ├── useAudioPlayer.js
    ├── useGameData.js
    └── useDailyGame.js
```

**After**:
```
src/
├── App.jsx (~150 lines)
├── components/
│   ├── RegionSelector.jsx
│   ├── ModeSelector.jsx
│   ├── StatsView.jsx
│   ├── SettingsView.jsx
│   └── GameView.jsx
├── hooks/
│   ├── useAudioPlayer.js
│   ├── useGameData.js
│   ├── useDailyGame.js
│   ├── usePersistence.js
│   ├── useGameNavigation.js
│   ├── useGameInitialization.js
│   ├── useShareResult.js
│   └── useMigration.js
└── utils/
    └── CacheUtils.jsx (optimized)
```

### Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| App.jsx lines | 796 | ~150 | -81% |
| Total files | 2 | 17+ | +750% |
| Avg file size | 489 lines | ~70 lines | -86% |
| Components | 0 | 5 | +5 |
| Hooks | 3 | 8 | +5 |
| Test coverage | 70% | ≥70% | Maintained |

### Benefits

1. **Maintainability**: Smaller files are easier to understand and modify
2. **Testability**: Isolated components and hooks are easier to test
3. **Reusability**: Components and hooks can be reused across the app
4. **Code Navigation**: Find functionality faster in smaller files
5. **Onboarding**: New developers can understand code quicker
6. **Debugging**: Isolate issues to specific files faster

## Risks and Mitigations

### Risk 1: Breaking Changes
**Mitigation**: Run tests after each plan, commit frequently

### Risk 2: Props Drilling
**Mitigation**: Use Zustand stores directly in components

### Risk 3: Circular Dependencies
**Mitigation**: Use dependency injection, keep utilities clean

### Risk 4: Test Coverage Drop
**Mitigation**: Add tests for new components/hooks, maintain ≥70%

### Risk 5: Performance Regression
**Mitigation**: Use React.memo where appropriate, profile renders

## Dependencies

- **Phase 2 (State Management)**: ✅ Complete
- **Zustand stores**: ✅ Implemented and tested

## Success Criteria

- [ ] App.jsx ≤200 lines
- [ ] All 157 existing tests pass
- [ ] New components have individual tests
- [ ] New hooks have individual tests
- [ ] Test coverage ≥70%
- [ ] ESLint passes with 0 errors, 0 warnings
- [ ] Production build successful
- [ ] Manual testing confirms all features work
- [ ] AGENTS.md updated with new structure
- [ ] No backward compatibility issues

## Timeline Estimate

- Plan 03-01: 1 day (analysis and planning)
- Plan 03-02: 1 day (extract hooks)
- Plan 03-03: 1-2 days (extract components)
- Plan 03-04: 0.5 day (optimize CacheUtils)
- Plan 03-05: 1 day (testing and validation)

**Total**: 4.5-5.5 days

## Notes

- All changes should be atomic and commit frequently
- Run tests after each plan
- Document any deviations from plans
- Create rollback plan if issues arise
- Update AGENTS.md after completion
