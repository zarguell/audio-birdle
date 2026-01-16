# Phase 2, Plan 1 Research: Zustand Integration Patterns

## Executive Summary

**Decision**: Use **separate stores with slices pattern** for Audio-Birdle's three game modes (normal, hard, practice).

**Rationale**: Independent state with clear separation → easier testing, better performance, cleaner code.

**Migration Strategy**: Dual-write approach (manual localStorage + Zustand) for 2 weeks to ensure zero data loss during transition.

---

## Recommended Architecture

### Store Structure

```
src/stores/
├── normalGameStore.ts      # Normal mode games & stats
├── hardModeStore.ts          # Hard mode games & stats
└── practiceStore.ts            # Practice mode (no persistence)
```

### Why Separate Stores?

1. **Independent State**: Each mode has completely different state structures
2. **Clear Separation**: Normal/hard/practice modes don't share state
3. **Easier Testing**: Isolated stores simpler to unit test
4. **Better Performance**: Components only subscribe to stores they actually use
5. **Focused Changes**: Bug fixes or features isolated to single mode

### State Shape Examples

**Normal Game Store:**
```typescript
{
  dailyGames: {
    "us-2025-01-15": {
      region: "us",
      date: "2025-01-15",
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4
    }
  },
  stats: {
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    averageGuesses: 0,
    currentStreak: 0,
    maxStreak: 0,
    regionStats: {
      "us": { gamesPlayed: 0, gamesWon: 0, averageGuesses: 0 }
    }
  },
  lastPlayed: { region: null, date: null },
  version: 2
}
```

**Hard Mode Store:**
```typescript
{
  hardModeGames: {
    "us-2025-01-15": {
      region: "us",
      date: "2025-01-15",
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 6,
      taxonomicScore: { order: false, family: false, genus: false }
    }
  },
  hardModeStats: {
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    averageGuesses: 0,
    currentStreak: 0,
    maxStreak: 0,
    regionStats: {
      "us": { gamesPlayed: 0, gamesWon: 0, averageGuesses: 0 }
    }
  },
  version: 2
}
```

**Practice Store:**
```typescript
{
  currentBird: null,
  guesses: [],
  completed: false
}
```

---

## React 19 Compatibility

**Status**: ✅ **VERIFIED**

**Evidence**: Zustand v5.0.8 is fully compatible with React 19.1.0. The core team confirmed this in [GitHub Discussion #2562](https://github.com/pmndrs/zustand/discussions/2562).

**No Action Required**: Use Zustand as-is with React 19.

---

## Persistence Strategy

### Zustand Persist Middleware

**Recommendation**: Use `persist` middleware with `createJSONStorage`

**Configuration**:
```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useNormalGameStore = create(
  persist(
    (set, get) => ({
      // ... state
    }),
    {
      name: 'audio-birdle-normal-game',
      storage: createJSONStorage(() => localStorage),
      version: 2,  // Critical for migration support
      migrate: handleMigration,  // Custom migration function
      onRehydrateStorage: () => console.log('Store hydrated')
    }
  )
)
```

### Storage Keys

**Current**: `STORAGE_KEYS.GAME_STATE` → entire state object

**With Zustand**: Automatic with each store:
- `audio-birdle-normal-game`
- `audio-birdle-hard-mode`
- Practice store not persisted

**Benefits**:
- Automatic hydration on page load
- Type-safe storage operations
- Built-in migration support via `version` and `migrate` options

---

## Migration Strategy: Zero Data Loss

### Phase 1: Dual-Write (Weeks 1-2)

**Goal**: Existing users keep their game progress while Zustand is introduced.

**Implementation**:
```typescript
// In GameLogic.jsx, add Zustand alongside existing localStorage calls
import { useNormalGameStore } from '@/stores/normalGameStore'

export const saveGameState = (gameState) => {
  // EXISTING: Keep manual localStorage working
  setStoredData(STORAGE_KEYS.GAME_STATE, gameState)

  // NEW: Also write to Zustand
  useNormalGameStore.getState().setDailyGame(key, game)
}
```

**Behavior**:
- Manual localStorage: Works as-is (backward compatibility)
- Zustand: New storage system (future-proof)
- Both systems write same data → zero data loss

### Phase 2: Migration Function

**Purpose**: Move from version 0 (manual) to version 2 (Zustand)

**Implementation**:
```typescript
// In utils/GameLogic.jsx
export const migrateGameState = (oldState: any) => {
  // Validate old state structure
  if (!oldState || typeof oldState !== 'object') {
    // Fresh start - use defaults
    return getInitialState()
  }

  // Migrate to new version 2 structure
  const newState = {
    version: 2,
    dailyGames: oldState.dailyGames || {},
    stats: oldState.stats || getDefaultStats(),
    lastPlayed: oldState.lastPlayed || { region: null, date: null }
  }

  // Backup old data
  setStoredData(STORAGE_KEYS.GAME_STATE + '-backup', oldState)

  return newState
}
```

**Migration Trigger**: Zustand's `migrate` option calls this when `version < 2`

### Phase 3: Clean-Up (After Week 2)

**Tasks**:
1. Remove manual `setStoredData(STORAGE_KEYS.GAME_STATE, ...)` calls
2. Remove `getStoredData(STORAGE_KEYS.GAME_STATE)` calls
3. Keep `StorageUtils.jsx` only for non-game data (cache etags)
4. Update tests to use Zustand instead of manual localStorage

---

## Testing Strategy

### Existing Vitest Setup: Already Configured

**Current State**: `vitest.config.js` has jsdom with localStorage mocks. **No changes needed**.

### New Tests Needed

**Store Tests**:
```typescript
// tests/unit/stores/normalGameStore.test.ts
describe('Normal Game Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useNormalGameStore.setState({
      dailyGames: {},
      stats: getDefaultStats(),
      version: 2
    })
  })

  it('should save daily game', () => {
    const game = { /* game data */ }
    useNormalGameStore.getState().setDailyGame('us-2025-01-15', game)

    const state = useNormalGameStore.getState()
    expect(state.dailyGames['us-2025-01-15']).toEqual(game)
  })

  it('should update stats after winning', () => {
    // ... test stats update logic
  })

  it('should persist to localStorage', () => {
    const game = { /* game data */ }
    useNormalGameStore.getState().setDailyGame('us-2025-01-15', game)

    const stored = localStorage.getItem('audio-birdle-normal-game')
    expect(stored).toBeTruthy()

    const parsed = JSON.parse(stored!)
    expect(parsed.state.dailyGames['us-2025-01-15']).toEqual(game)
  })
})
```

**Migration Tests**:
```typescript
// tests/unit/migrations/gameStateMigration.test.ts
describe('Game State Migration', () => {
  it('should migrate v1 to v2', () => {
    const oldV1State = {
      version: 1,
      dailyGames: { 'us-2025-01-15': { /* old structure */ } }
    }

    const migrated = migrateGameState(oldV1State)

    expect(migrated.version).toBe(2)
    expect(migrated.dailyGames).toBeDefined()
  })
})
```

---

## Implementation Roadmap

### Week 1: Foundation

1. ✅ Install Zustand (`npm install zustand`)
2. Create store files in `src/stores/` directory
3. Implement migration function in `utils/GameLogic.jsx`
4. Add dual-write to existing save functions

### Week 2: Testing

1. Write unit tests for all stores (normal, hard, practice)
2. Write migration tests
3. Test in development with existing localStorage data
4. Verify no data loss occurs

### Week 3: Rollout

1. Deploy to production (dual-write active)
2. Monitor for 1 week
3. Remove manual localStorage code
4. Clean up `StorageUtils.jsx`

---

## Key Benefits

1. **Zero Data Loss**: Dual-write ensures backward compatibility
2. **Type Safety**: Full TypeScript support for all state
3. **Better DevTools**: Zustand DevTools integration for debugging
4. **Simpler Code**: Remove complex manual localStorage logic
5. **Easier Testing**: Stores are isolated and testable
6. **Performance**: Selective subscriptions prevent unnecessary re-renders
7. **Future-Proof**: Built-in migration system for schema changes
8. **Independent Stores**: Normal/hard/practice modes don't share state

---

## Dependencies

**Installed**: `zustand@latest` (v5.0.8+)

**No Additional Dependencies Needed**: Zustand includes all middleware (persist, devtools, immer).

**Optional Additions**:
- `zustand-devtools` - For state inspection during development

---

## Resources

- [Zustand Persist Middleware Docs](https://zustand.docs.pmnd.rs/middlewares/persist)
- [Zustand Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern)
- [React 19 Compatibility Discussion](https://github.com/pmndrs/zustand/discussions/2562)
- [Production Examples](https://github.com/reworkd/AgentGPT/blob/next/src/stores/configStore.ts)
