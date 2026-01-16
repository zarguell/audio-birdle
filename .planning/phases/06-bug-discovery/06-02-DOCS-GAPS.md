# Documentation Gaps

**Created:** 2026-01-16
**Review Status:** Complete

## Identified Gaps

### 1. [DOC-001] RetryUtils Usage Patterns
**Files:** `src/utils/RetryUtils.jsx`, AGENTS.md

**Current Documentation:**
- Basic import statement in AGENTS.md
- One example for fetchWithRetry

**Missing:**
- Examples for retryWithBackoff()
- Error handling patterns
- Configuration options explained
- When to use fetchWithRetry vs retryWithBackoff
- Integration with other utilities

**Needed Additions:**
```javascript
// retryWithBackoff example
const result = await retryWithBackoff(
  async () => {
    const data = await someAsyncOperation();
    if (!data) throw new Error('No data');
    return data;
  },
  { maxRetries: 2, baseDelay: 500, context: 'data-fetch' }
);
```

**Estimate:** Quick (10-15 min)

---

### 2. [DOC-002] StorageUtils API Documentation
**Files:** `src/utils/StorageUtils.jsx`, AGENTS.md

**Current Documentation:**
- Basic usage example in AGENTS.md
- Import statements

**Missing:**
- Complete API reference (all functions)
- Error handling documentation (QuotaExceededError)
- isStorageAvailable() usage
- getStorage default value parameter
- setStorage automatic stringification
- removeStorage usage
- Migration patterns from localStorage directly

**Needed Additions:**
```javascript
// Complete API reference
import {
  getStorage,      // Get with default value
  setStorage,      // Set with auto-stringify
  removeStorage,   // Remove item
  isStorageAvailable // Check availability
} from './utils/StorageUtils';

// Error handling
if (isStorageAvailable()) {
  try {
    setStorage('key', data);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      // Handle quota exceeded
    }
  }
}
```

**Estimate:** Quick (10-15 min)

---

### 3. [DOC-003] Zustand Store Patterns
**Files:** `src/stores/normalGameStore.ts`, `src/stores/hardModeStore.ts`, `src/stores/practiceStore.ts`, AGENTS.md

**Current Documentation:**
- Store structure mentioned in AGENTS.md
- No usage examples

**Missing:**
- How to use stores in components
- Store persistence configuration
- Store migration patterns
- Action vs state access patterns
- Testing with stores
- Store hydration/rehydration

**Needed Additions:**
```javascript
// Component usage
import { useNormalGameStore } from '@/stores/normalGameStore';

function GameComponent() {
  // Access state
  const dailyGames = useNormalGameStore(state => state.dailyGames);

  // Access actions
  const processGuess = useNormalGameStore(state => state.processGuess);

  // Use in effects
  const store = useNormalGameStore.getState();
  const game = store.getDailyGame('us-2025-01-16');
}

// Testing with stores
import { useNormalGameStore } from '@/stores/normalGameStore';

beforeEach(() => {
  useNormalGameStore.getState().reset();
});
```

**Estimate:** Quick (10-15 min)

---

### 4. [DOC-004] HashUtils Canonical Implementation
**Files:** `src/utils/HashUtils.jsx`, AGENTS.md

**Current Documentation:**
- Hash algorithm documented in AGENTS.md
- Salt documented

**Missing:**
- Why canonical is important (data pipeline)
- When to use hashString
- Python equivalent reference
- Test vectors for verification

**Needed Additions:**
- Data pipeline diagram (Python → daily.json → Frontend)
- Test vectors for verification
- Migration strategy if algorithm changes

**Estimate:** Quick (5-10 min)

---

### 5. [DOC-005] GameLogic Hybrid Approach
**Files:** `src/utils/GameLogic.jsx`, AGENTS.md

**Current Documentation:**
- GameLogic functions listed
- State management structure documented

**Missing:**
- Hybrid approach explanation (GameLogic + stores)
- Backward compatibility with tests
- Migration path from old GameLogic-only to store-based
- When to use GameLogic vs stores directly

**Needed Additions:**
- Architecture diagram showing data flow
- Migration guide for existing code
- Best practices for new features

**Estimate:** Medium (15-20 min)

---

### 6. [DOC-006] Cache Management
**Files:** `src/utils/CacheUtils.jsx`, AGENTS.md

**Current Documentation:**
- Cache management utilities mentioned

**Missing:**
- Service worker cache vs localStorage cache
- Version tracking strategy (ETag, Last-Modified)
- When cache is invalidated
- Manual cache refresh flow
- PWA cache considerations

**Needed Additions:**
- Cache architecture diagram
- Invalidation triggers
- Debugging cache issues

**Estimate:** Medium (15-20 min)

---

### 7. [DOC-007] Test Patterns
**Files:** `tests/integration/README.md`, AGENTS.md

**Current Documentation:**
- Test structure documented
- Fixtures mentioned

**Missing:**
- Store testing patterns
- Mock patterns for localStorage, fetch, Audio
- Integration test patterns
- Test isolation and cleanup

**Needed Additions:**
- Testing guide with examples
- Common testing patterns
- Debugging failing tests

**Estimate:** Medium (20-30 min)

---

### 8. [DOC-008] Component Architecture
**Files:** `src/components/*.jsx`, AGENTS.md

**Current Documentation:**
- Component list in project structure
- Refactoring mentioned

**Missing:**
- Component hierarchy diagram
- Props and state flow
- Hook usage patterns
- When to extract components

**Needed Additions:**
- Component architecture diagram
- Props flow documentation
- State lifting patterns

**Estimate:** Medium (15-20 min)

---

## Summary

**Total Gaps:** 8 documentation areas
**Total Estimate:** 1.5-2 hours

**By Priority:**
- High Priority (Core Utilities): DOC-001, DOC-002, DOC-003 (45 min)
- Medium Priority (Architecture): DOC-004, DOC-005, DOC-006 (55 min)
- Lower Priority (Guides): DOC-007, DOC-008 (50 min)

**By Complexity:**
- Quick (10-15 min): DOC-001, DOC-002, DOC-003, DOC-004
- Medium (15-30 min): DOC-005, DOC-006, DOC-007, DOC-008

## Recommendations

### Sprint 1: Core Utilities (Plan 07-03)
1. DOC-001: RetryUtils examples
2. DOC-002: StorageUtils API
3. DOC-003: Zustand store patterns

**Time:** 45 minutes
**Impact:** Immediate developer productivity

### Sprint 2: Architecture (Future)
4. DOC-004: HashUtils canonical
5. DOC-005: GameLogic hybrid
6. DOC-006: Cache management

**Time:** 55 minutes
**Impact:** Better understanding of system architecture

### Sprint 3: Developer Guides (Future)
7. DOC-007: Test patterns
8. DOC-008: Component architecture

**Time:** 50 minutes
**Impact:** Onboarding and maintenance

## Notes

- **Documentation Debt:** Accumulated during refactoring phases
- **Priority:** Focus on core utilities first (highest usage)
- **Format:** Add to AGENTS.md or create separate docs/
- **Examples:** All documentation should include code examples
- **Diagrams:** Architecture diagrams for complex systems
