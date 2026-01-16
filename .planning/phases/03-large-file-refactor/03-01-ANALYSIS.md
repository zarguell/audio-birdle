# App.jsx and CacheUtils.jsx Analysis

## Executive Summary

This document provides a comprehensive analysis of App.jsx (797 lines) and CacheUtils.jsx (184 lines) to prepare for refactoring. The goal is to extract responsibilities into smaller, focused modules to improve maintainability and testability.

---

## App.jsx Analysis

### Overview

- **Total Lines:** 797
- **Primary Responsibilities:** Main application component with view routing, state management, and game orchestration
- **Complexity:** High - contains 5 render functions, multiple useEffect hooks, and mixed concerns

### State Variables and Their Purposes

| State Variable   | Type   | Purpose                                              | Dependencies                  |
| ---------------- | ------ | ---------------------------------------------------- | ----------------------------- |
| `selectedRegion` | string | Currently selected region (e.g., "us", "eu")         | Initialized from localStorage |
| `lastPlayedMode` | string | Last game mode played ("normal", "hard", "practice") | Initialized from localStorage |
| `currentView`    | string | Current view/page (from VIEWS constant)              | None                          |

**Total local state:** 3 variables
**External state:** Zustand stores (useNormalGameStore, useHardModeStore)

### Custom Hooks Used

| Hook             | Purpose                     | Return Values                                                                                                                                      |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAudioPlayer` | Audio playback management   | isPlaying, audioError, setAudioError, selectedAudioIndex, setSelectedAudioIndex, audioRef, toggleAudio, handleAudioError                           |
| `useGameData`    | Data loading and refreshing | regions, birds, todaysBird, loadingBird, dataConsistencyError, hasUpdate, refreshingData, handleAutoRefresh, handleForceRefresh, handleRefreshData |
| `useDailyGame`   | Game state and actions      | makeGuess, resetTodaysGame, resetAllData, getDailyGame, answerOptions, makeHardModeGuess, resetTodaysGame, resetAllData, getHardModeGame           |

### Render Functions (with Line Counts)

| Function               | Lines               | Purpose                      | Complexity |
| ---------------------- | ------------------- | ---------------------------- | ---------- |
| `renderRegionSelector` | 134-175 (42 lines)  | Region selection UI          | Low        |
| `renderModeSelector`   | 178-296 (119 lines) | Game mode selection          | Medium     |
| `renderStats`          | 298-400 (103 lines) | Statistics display           | Medium     |
| `renderSettings`       | 402-478 (77 lines)  | Settings view                | Low        |
| `renderGame`           | 480-750 (271 lines) | Main game view (normal mode) | High       |

**Total render function code:** ~612 lines (77% of file)

### useEffect Hooks Analysis

| Hook                | Lines   | Purpose                             | Dependencies                              | Frequency             |
| ------------------- | ------- | ----------------------------------- | ----------------------------------------- | --------------------- |
| Migration           | 102-114 | Migrate old localStorage to Zustand | []                                        | Once on mount         |
| Game Initialization | 117-132 | Initialize game for today           | [selectedRegion, today, currentDailyGame] | On region/date change |

**Total useEffect code:** ~30 lines

### Key Responsibilities Mapping

| Responsibility             | Lines   | Type                 | Extractable?                                 |
| -------------------------- | ------- | -------------------- | -------------------------------------------- |
| **Persistence Management** | 31-37   | State initialization | Yes (usePersistence hook)                    |
| **Migration Logic**        | 102-114 | useEffect            | Yes (useMigration hook)                      |
| **Game Initialization**    | 117-132 | useEffect            | Yes (useGameInitialization hook)             |
| **Share Functionality**    | 88-99   | useCallback          | Yes (useShareResult hook)                    |
| **View Routing**           | 752-796 | Main render logic    | Yes (useGameNavigation hook)                 |
| **Region Selector**        | 134-175 | Render function      | Yes (RegionSelector component)               |
| **Mode Selector**          | 178-296 | Render function      | Yes (ModeSelector component)                 |
| **Stats View**             | 298-400 | Render function      | Yes (StatsView component)                    |
| **Settings View**          | 402-478 | Render function      | Yes (SettingsView component)                 |
| **Game View**              | 480-750 | Render function      | Yes (GameView component with sub-components) |

### Data Flow Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                        App.jsx                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Persistence (localStorage)                                  │
│     ↓                                                        │
│  State Initialization (useState)                            │
│     ↓                                                        │
│  Custom Hooks (useAudioPlayer, useGameData, useDailyGame)    │
│     ↓                                                        │
│  View State (currentView)                                    │
│     ↓                                                        │
│  Render Functions (RegionSelector, ModeSelector, etc.)        │
│     ↓                                                        │
│  Game Components (PracticeGame, HardModeGame)                │
│     ↓                                                        │
│  Zustand Stores (normalGameStore, hardModeStore)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Dependencies Between Sections

| Section                | Depends On                                         | Dependencies                                  |
| ---------------------- | -------------------------------------------------- | --------------------------------------------- |
| `renderRegionSelector` | regions                                            | useGameData.regions, useNormalGameStore       |
| `renderModeSelector`   | regions, selectedRegion, lastPlayedMode            | useGameData.regions, local state              |
| `renderStats`          | regions                                            | useGameData.regions, useNormalGameStore       |
| `renderSettings`       | regions, selectedRegion, hasUpdate, refreshingData | useGameData.regions, local state, useGameData |
| `renderGame`           | Everything                                         | All hooks, stores, and state                  |
| `useEffect` hooks      | Stores                                             | useNormalGameStore, useHardModeStore          |

### Code Quality Issues

1. **Monolithic Render Functions:** `renderGame` is 271 lines and handles too many concerns (audio, guesses, hints, completion, settings)
2. **Mixed Concerns:** App.jsx combines view routing, state management, migration, and data fetching
3. **Inline Logic:** Complex game logic embedded in render functions instead of utilities
4. **Hard-to-Test:** Large render functions are difficult to unit test

---

## CacheUtils.jsx Analysis

### Overview

- **Total Lines:** 184
- **Primary Responsibilities:** Cache management, version tracking, data refresh
- **Complexity:** Medium - repetitive patterns but well-organized

### Structure Breakdown

| Section                     | Lines   | Purpose                     | Complexity |
| --------------------------- | ------- | --------------------------- | ---------- |
| Constants                   | 12-18   | Data file paths             | Low        |
| `getServiceWorker`          | 24-36   | Service worker registration | Low        |
| `checkDailyJsonUpdate`      | 43-48   | Daily.json version check    | Low        |
| `checkForUpdates`           | 54-68   | General update check        | Low        |
| `storeVersionInfo`          | 74-75   | Store version metadata      | Low        |
| `storeDailyJsonVersionInfo` | 81-87   | Store daily.json version    | Low        |
| `storeBirdsJsonVersionInfo` | 94-95   | Store birds.json version    | Low        |
| `checkBirdsJsonUpdate`      | 101-106 | Birds.json version check    | Low        |
| `hasDateChanged`            | 112-125 | Date validation             | Low        |
| `clearServiceWorkerCache`   | 131-140 | Cache clearing              | Low        |
| `refreshGameData`           | 147-183 | Force refresh data          | Medium     |

### Try/Catch Block Analysis

| Function                  | Try/Catch Blocks | Error Handling               | Purpose              |
| ------------------------- | ---------------- | ---------------------------- | -------------------- |
| `getServiceWorker`        | 1                | Console error + return null  | Graceful degradation |
| `hasDateChanged`          | 1                | Console warn + return true   | Fallback to true     |
| `clearServiceWorkerCache` | 1                | Console error + return false | Graceful degradation |
| `refreshGameData`         | 0                | Throws errors up             | Propagates errors    |

**Total Try/Catch Blocks:** 3 (appropriate use for graceful degradation)

### Version Tracking Logic

**Three separate version stores:**

1. **General cache** (regions.json, birds.json): `CACHE_LAST_MODIFIED`, `CACHE_ETAG`
2. **Daily.json specific:** `DAILY_JSON_LAST_MODIFIED`, `DAILY_JSON_ETAG`
3. **Birds.json specific:** `BIRDS_JSON_LAST_MODIFIED`, `BIRDS_JSON_ETAG`

**Pattern:** Each data file has:

- Last-modified timestamp (HTTP header)
- ETag (entity tag for content validation)
- Storage keys in Constants.jsx

### Repetitive Patterns

1. **Version checking pattern (appears 3x):**

   ```javascript
   checkDataFileUpdate(
     "/data/file.json",
     STORAGE_KEYS.FILE_LAST_MODIFIED,
     STORAGE_KEYS.FILE_ETAG,
   );
   ```

   **Consolidation opportunity:** Create generic function with parameters

2. **Version storing pattern (appears 3x):**

   ```javascript
   storeDataFileVersion(
     response,
     STORAGE_KEYS.FILE_LAST_MODIFIED,
     STORAGE_KEYS.FILE_ETAG,
   );
   ```

   **Consolidation opportunity:** Already consolidated via versionUtils

3. **Refresh data pattern (appears in 3 refresh functions in useGameData):**
   ```javascript
   clearServiceWorkerCache();
   const { regions: newRegions, birds: newBirds } = await refreshGameData();
   setRegions(newRegions);
   setBirds(newBirds);
   // Reload today's bird...
   ```
   **Consolidation opportunity:** Extract common refresh logic

### Documentation Quality

| Function                    | Documentation | Score |
| --------------------------- | ------------- | ----- |
| `getServiceWorker`          | ✅ Clear      | 9/10  |
| `checkDailyJsonUpdate`      | ✅ Clear      | 9/10  |
| `checkForUpdates`           | ✅ Clear      | 9/10  |
| `storeVersionInfo`          | ✅ Clear      | 9/10  |
| `storeDailyJsonVersionInfo` | ✅ Clear      | 9/10  |
| `storeBirdsJsonVersionInfo` | ✅ Clear      | 9/10  |
| `checkBirdsJsonUpdate`      | ✅ Clear      | 9/10  |
| `hasDateChanged`            | ✅ Clear      | 9/10  |
| `clearServiceWorkerCache`   | ✅ Clear      | 9/10  |
| `refreshGameData`           | ✅ Clear      | 8/10  |

**Overall documentation score:** 9/10 (excellent)

### Testing Coverage Gaps

| Function                    | Test Coverage | Gaps                                             |
| --------------------------- | ------------- | ------------------------------------------------ |
| `getServiceWorker`          | ❌ Untested   | Needs unit tests for service worker availability |
| `checkDailyJsonUpdate`      | ❌ Untested   | Needs tests with mocked versionUtils             |
| `checkForUpdates`           | ❌ Untested   | Needs tests with multiple file updates           |
| `storeVersionInfo`          | ❌ Untested   | Needs tests with mocked responses                |
| `storeDailyJsonVersionInfo` | ❌ Untested   | Needs tests with date validation                 |
| `storeBirdsJsonVersionInfo` | ❌ Untested   | Needs tests with bird-specific validation        |
| `checkBirdsJsonUpdate`      | ❌ Untested   | Needs tests with mocked versionUtils             |
| `hasDateChanged`            | ❌ Untested   | Needs tests for date comparison                  |
| `clearServiceWorkerCache`   | ❌ Untested   | Needs tests with mocked caches API               |
| `refreshGameData`           | ❌ Untested   | Needs integration tests with fetch mocking       |

**Current test coverage:** ~0% (no tests exist)
**Target coverage:** 80%+

### Optimization Opportunities

1. **Consolidate version checking functions** (3 similar functions → 1 generic)
2. **Extract refresh pattern** (reused 3x in useGameData → shared utility)
3. **Add error recovery** (currently just logs errors)
4. **Add retry logic** (for failed fetches)
5. **Cache metrics** (track cache hit/miss rates)
6. **Simplify refreshGameData** (currently fetches all 5 files but only stores 3)

---

## Extraction Recommendations

### Custom Hooks to Extract from App.jsx

| Hook Name               | Responsibility               | Lines   | Priority | Dependencies                         |
| ----------------------- | ---------------------------- | ------- | -------- | ------------------------------------ |
| `usePersistence`        | Load/save localStorage state | 31-37   | Medium   | StorageUtils                         |
| `useGameInitialization` | Initialize game for today    | 117-132 | High     | useNormalGameStore                   |
| `useMigration`          | Migrate old data format      | 102-114 | Low      | useNormalGameStore, useHardModeStore |
| `useShareResult`        | Share functionality          | 88-99   | Medium   | ShareUtils                           |
| `useGameNavigation`     | View routing and navigation  | 752-796 | High     | All hooks, stores                    |

### Components to Extract from App.jsx

| Component Name       | Current Location     | Lines   | Priority | Props Needed                                                                                                                       |
| -------------------- | -------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `RegionSelector`     | renderRegionSelector | 134-175 | Low      | regions, onSelect, today                                                                                                           |
| `ModeSelector`       | renderModeSelector   | 178-296 | Medium   | modes, onSelect, lastPlayedMode, onSettings                                                                                        |
| `StatsView`          | renderStats          | 298-400 | Medium   | stats, regions, onBack                                                                                                             |
| `SettingsView`       | renderSettings       | 402-478 | Medium   | region, onChangeRegion, onBack, onStats, hasUpdate, refreshingData, handleRefresh                                                  |
| `GameView`           | renderGame           | 480-750 | High     | All game data, hooks, functions                                                                                                    |
| `AudioPlayerSection` | (within renderGame)  | 586-656 | High     | todaysBird, selectedAudioIndex, toggleAudio, isPlaying, audioError, loadingBird, setSelectedAudioIndex, audioRef, handleAudioError |
| `GuessesList`        | (within renderGame)  | 659-687 | Medium   | guesses, answerOptions                                                                                                             |
| `AnswerChoices`      | (within renderGame)  | 699-720 | Medium   | options, onGuess, game                                                                                                             |
| `GameCompleted`      | (within renderGame)  | 723-740 | Medium   | won, todaysBird, selectedAudioIndex, onShare                                                                                       |

### Proposed New File Structure

```
src/
├── App.jsx (simplified main component - ~200 lines)
├── components/
│   ├── RegionSelector/
│   │   └── RegionSelector.jsx (~45 lines)
│   ├── ModeSelector/
│   │   └── ModeSelector.jsx (~120 lines)
│   ├── StatsView/
│   │   └── StatsView.jsx (~100 lines)
│   ├── SettingsView/
│   │   └── SettingsView.jsx (~80 lines)
│   └── GameView/
│       ├── GameView.jsx (~270 lines)
│       ├── AudioPlayerSection.jsx (~70 lines)
│       ├── GuessesList.jsx (~30 lines)
│       ├── AnswerChoices.jsx (~25 lines)
│       └── GameCompleted.jsx (~20 lines)
├── hooks/
│   ├── usePersistence.js (new - ~30 lines)
│   ├── useGameInitialization.js (new - ~20 lines)
│   ├── useMigration.js (new - ~15 lines)
│   ├── useShareResult.js (new - ~15 lines)
│   └── useGameNavigation.js (new - ~50 lines)
└── utils/
    └── CacheUtils.jsx (refactored - ~150 lines)
```

### Dependency Graph (Extraction Order)

```
Step 1: Extract Custom Hooks (no dependencies)
├── useMigration (lowest priority)
├── usePersistence
├── useShareResult
├── useGameInitialization
└── useGameNavigation (depends on all above)

Step 2: Extract Leaf Components (no dependencies on other components)
├── RegionSelector
├── ModeSelector
├── StatsView
└── SettingsView

Step 3: Extract GameView Sub-components
├── AudioPlayerSection
├── GuessesList
├── AnswerChoices
└── GameCompleted

Step 4: Extract GameView (depends on sub-components)

Step 5: Refactor App.jsx to use all new hooks and components
```

---

## Risk Assessment

### High Risk Extractions

| Extraction          | Risk                            | Mitigation                                    |
| ------------------- | ------------------------------- | --------------------------------------------- |
| `useGameNavigation` | Changes core view routing logic | Write integration tests before extraction     |
| `GameView`          | Largest component (271 lines)   | Extract sub-components first, test thoroughly |

### Medium Risk Extractions

| Extraction              | Risk                              | Mitigation                         |
| ----------------------- | --------------------------------- | ---------------------------------- |
| `useGameInitialization` | Interacts with Zustand store      | Mock store in tests                |
| `SettingsView`          | Depends on multiple state sources | Use TypeScript for prop validation |
| `AudioPlayerSection`    | Complex audio state management    | Test with mocked audio element     |

### Low Risk Extractions

| Extraction       | Risk                          | Mitigation                        |
| ---------------- | ----------------------------- | --------------------------------- |
| `RegionSelector` | Simple UI component           | Write snapshot tests              |
| `ModeSelector`   | Pure presentational component | Write snapshot tests              |
| `StatsView`      | Read-only display             | Write unit tests with mocked data |

---

## Detailed Extraction Plan

### Phase 1: Custom Hooks Extraction (Lowest Risk)

#### 1.1 Extract `usePersistence` Hook

**File:** `src/hooks/usePersistence.js`
**Lines from App.jsx:** 31-37
**Responsibility:** Initialize state from localStorage

```javascript
export function usePersistence() {
  const [selectedRegion, setSelectedRegion] = useState(() =>
    getStoredData(STORAGE_KEYS.REGION, null),
  );
  const [lastPlayedMode, setLastPlayedMode] = useState(() =>
    getStoredData(STORAGE_KEYS.LAST_PLAYED_MODE, "normal"),
  );
  return {
    selectedRegion,
    setSelectedRegion,
    lastPlayedMode,
    setLastPlayedMode,
  };
}
```

**Props Interface:**

```javascript
// Returns:
{
  selectedRegion: string | null,
  setSelectedRegion: (region: string) => void,
  lastPlayedMode: string,
  setLastPlayedMode: (mode: string) => void,
}
```

**Dependencies:** StorageUtils, STORAGE_KEYS
**Test Strategy:** Mock localStorage with test fixtures

#### 1.2 Extract `useMigration` Hook

**File:** `src/hooks/useMigration.js`
**Lines from App.jsx:** 102-114
**Responsibility:** Migrate old localStorage to Zustand format

```javascript
export function useMigration() {
  useEffect(() => {
    const normalStore = useNormalGameStore.getState();
    const hardStore = useHardModeStore.getState();
    console.log("App mounted: Checking for old data to migrate...");
    normalStore.migrateFromOldFormat();
    hardStore.migrateFromOldFormat();
    console.log("Migration check complete");
  }, []);
}
```

**Props Interface:** None (no return value)
**Dependencies:** useNormalGameStore, useHardModeStore
**Test Strategy:** Mock stores, verify migration functions called

#### 1.3 Extract `useShareResult` Hook

**File:** `src/hooks/useShareResult.js`
**Lines from App.jsx:** 88-99
**Responsibility:** Generate and share game results

```javascript
export function useShareResult(currentDailyGame, todaysBird, selectedRegion) {
  const handleShareResult = useCallback(async () => {
    if (!currentDailyGame || !todaysBird) return;
    const shareText = generateShareText(
      currentDailyGame,
      window.location.href,
      todaysBird.name,
      selectedRegion,
    );
    shareResult(shareText);
  }, [currentDailyGame, todaysBird, selectedRegion]);

  return handleShareResult;
}
```

**Props Interface:**

```javascript
// Input:
{
  currentDailyGame: Game | null,
  todaysBird: Bird | null,
  selectedRegion: string,
}
// Returns: (callback) => Promise<void>
```

**Dependencies:** ShareUtils, window.location
**Test Strategy:** Mock generateShareText and shareResult functions

#### 1.4 Extract `useGameInitialization` Hook

**File:** `src/hooks/useGameInitialization.js`
**Lines from App.jsx:** 117-132
**Responsibility:** Initialize daily game if not exists

```javascript
export function useGameInitialization(selectedRegion, today, currentDailyGame) {
  useEffect(() => {
    if (selectedRegion && today && !currentDailyGame) {
      const key = `${selectedRegion}-${today}`;
      const existingGame = useNormalGameStore.getState().getDailyGame(key);
      if (!existingGame) {
        useNormalGameStore.getState().setDailyGame(key, {
          region: selectedRegion,
          date: today,
          guesses: [],
          completed: false,
          won: false,
          maxGuesses: 4,
        });
      }
    }
  }, [selectedRegion, today, currentDailyGame]);
}
```

**Props Interface:**

```javascript
// Input:
{
  selectedRegion: string | null,
  today: string,
  currentDailyGame: Game | null,
}
// Returns: void (no return value)
```

**Dependencies:** useNormalGameStore
**Test Strategy:** Mock store, verify setDailyGame called correctly

#### 1.5 Extract `useGameNavigation` Hook

**File:** `src/hooks/useGameNavigation.js`
**Lines from App.jsx:** 752-796
**Responsibility:** View routing and navigation logic

```javascript
export function useGameNavigation({
  selectedRegion,
  currentView,
  setCurrentView,
  regions,
  birds,
  PracticeGame,
  HardModeGame,
  today,
}) {
  const renderRegionSelector = () => (
    <RegionSelector
      regions={regions}
      onSelect={setSelectedRegion}
      today={today}
    />
  );

  const renderModeSelector = () => (
    <ModeSelector
      modes={gameModes}
      onSelect={(mode) => {
        setCurrentView(mode.view);
        setLastPlayedMode(mode.mode);
      }}
      lastPlayedMode={lastPlayedMode}
      onSettings={() => setCurrentView(VIEWS.SETTINGS)}
    />
  );

  const renderStats = () => (
    <StatsView
      stats={useNormalGameStore.getState().stats}
      regions={regions}
      onBack={() => setCurrentView(VIEWS.SETTINGS)}
    />
  );

  const renderSettings = () => (
    <SettingsView
      region={selectedRegion}
      onChangeRegion={() => setSelectedRegion(null)}
      onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      onStats={() => setCurrentView(VIEWS.STATS)}
      hasUpdate={hasUpdate}
      refreshingData={refreshingData}
      handleRefresh={handleRefreshData}
    />
  );

  const renderGame = () => (
    <GameView
    // ... all game props
    />
  );

  const renderPractice = () => (
    <PracticeGame
      region={selectedRegion}
      birds={birds}
      regions={regions}
      onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
    />
  );

  const renderHardMode = () => (
    <HardModeGame
      region={selectedRegion}
      birds={birds}
      todaysBird={todaysBird}
      onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      normalModeCompleted={normalModeCompleted}
    />
  );

  // Main routing logic
  if (!selectedRegion) return renderRegionSelector();
  if (currentView === VIEWS.MODE_SELECTOR) return renderModeSelector();
  if (currentView === VIEWS.PRACTICE) return renderPractice();
  if (currentView === VIEWS.HARD_MODE) return renderHardMode();
  if (currentView === VIEWS.SETTINGS) return renderSettings();
  if (currentView === VIEWS.STATS) return renderStats();
  return renderGame();
}
```

**Props Interface:**

```javascript
// Input:
{
  selectedRegion: string | null,
  currentView: string,
  setCurrentView: (view: string) => void,
  regions: Region[],
  birds: Object,
  PracticeGame: Component,
  HardModeGame: Component,
  today: string,
  // ... other game props
}
// Returns: JSX.Element (current view)
```

**Dependencies:** All new components, existing game hooks
**Test Strategy:** Integration tests with mocked components

---

### Phase 2: Component Extraction (Lowest Risk First)

#### 2.1 Extract `RegionSelector` Component

**File:** `src/components/RegionSelector/RegionSelector.jsx`
**Lines from App.jsx:** 134-175
**Responsibility:** Region selection UI

**Props Interface:**

```javascript
{
  regions: Region[],
  onSelect: (regionId: string) => void,
  today: string,
}
```

**Dependencies:** useNormalGameStore, createRegionDateKey
**Test Strategy:** Snapshot tests, interaction tests

#### 2.2 Extract `ModeSelector` Component

**File:** `src/components/ModeSelector/ModeSelector.jsx`
**Lines from App.jsx:** 178-296
**Responsibility:** Game mode selection UI

**Props Interface:**

```javascript
{
  modes: Mode[],
  onSelect: (mode: Mode) => void,
  lastPlayedMode: string,
  onSettings: () => void,
  currentRegion: string,
  regions: Region[],
}
```

**Dependencies:** VIEWS constant
**Test Strategy:** Snapshot tests, click interaction tests

#### 2.3 Extract `StatsView` Component

**File:** `src/components/StatsView/StatsView.jsx`
**Lines from App.jsx:** 298-400
**Responsibility:** Statistics display

**Props Interface:**

```javascript
{
  stats: Stats,
  regions: Region[],
  onBack: () => void,
}
```

**Dependencies:** None (pure presentational)
**Test Strategy:** Unit tests with mock stats data

#### 2.4 Extract `SettingsView` Component

**File:** `src/components/SettingsView/SettingsView.jsx`
**Lines from App.jsx:** 402-478
**Responsibility:** Settings and data management UI

**Props Interface:**

```javascript
{
  region: string,
  onChangeRegion: () => void,
  onBack: () => void,
  onStats: () => void,
  hasUpdate: boolean,
  refreshingData: boolean,
  handleRefresh: () => Promise<void>,
  resetTodaysGame: () => void,
  resetAllData: () => void,
}
```

**Dependencies:** None
**Test Strategy:** Interaction tests with mocked callbacks

---

### Phase 3: GameView Sub-components (Medium Risk)

#### 3.1 Extract `AudioPlayerSection` Component

**File:** `src/components/GameView/AudioPlayerSection.jsx`
**Lines from App.jsx:** 586-656
**Responsibility:** Audio playback controls

**Props Interface:**

```javascript
{
  todaysBird: Bird | null,
  selectedAudioIndex: number,
  setSelectedAudioIndex: (index: number) => void,
  toggleAudio: () => Promise<void>,
  isPlaying: boolean,
  audioError: boolean,
  loadingBird: boolean,
  audioRef: RefObject<HTMLAudioElement>,
  handleAudioError: () => void,
}
```

**Dependencies:** getAudioSrc, lucide-react icons
**Test Strategy:** Tests with mocked audio element

#### 3.2 Extract `GuessesList` Component

**File:** `src/components/GameView/GuessesList.jsx`
**Lines from App.jsx:** 659-687
**Responsibility:** Display previous guesses

**Props Interface:**

```javascript
{
  guesses: Guess[],
  answerOptions: Bird[],
}
```

**Dependencies:** None (pure presentational)
**Test Strategy:** Unit tests with mock guess data

#### 3.3 Extract `AnswerChoices` Component

**File:** `src/components/GameView/AnswerChoices.jsx`
**Lines from App.jsx:** 699-720
**Responsibility:** Display answer options

**Props Interface:**

```javascript
{
  options: Bird[],
  onGuess: (birdId: string) => void,
  currentGuess: number,
  maxGuesses: number,
}
```

**Dependencies:** None (pure presentational)
**Test Strategy:** Interaction tests with mocked onGuess

#### 3.4 Extract `GameCompleted` Component

**File:** `src/components/GameView/GameCompleted.jsx`
**Lines from App.jsx:** 723-740
**Responsibility:** Display game completion state

**Props Interface:**

```javascript
{
  won: boolean,
  todaysBird: Bird,
  selectedAudioIndex: number,
  onShare: () => Promise<void>,
}
```

**Dependencies:** BirdCompletionCard
**Test Strategy:** Snapshot tests for both win/lose states

---

### Phase 4: Extract `GameView` Component (High Risk)

#### 4.1 Extract `GameView` Component

**File:** `src/components/GameView/GameView.jsx`
**Lines from App.jsx:** 480-750
**Responsibility:** Main game view with all game logic

**Props Interface:**

```javascript
{
  // Data
  regions: Region[],
  selectedRegion: string,
  today: string,
  birds: BirdsObject,
  todaysBird: Bird | null,
  currentDailyGame: Game | null,
  answerOptions: Bird[],
  loadingBird: boolean,
  dataConsistencyError: string | null,
  hasUpdate: boolean,

  // Audio
  audioPlayer: AudioPlayerReturn,
  handleAudioEnded: () => void,

  // Actions
  makeGuess: (birdId: string) => void,
  handleShareResult: () => Promise<void>,

  // Navigation
  onChangeView: (view: string) => void,
  onHardMode: () => void,
  onPractice: () => void,
  onSettings: () => void,

  // Store state
  hardModeCompleted: boolean,
}
```

**Dependencies:** All GameView sub-components, existing utilities
**Test Strategy:** Integration tests with mocked all dependencies

---

## File Structure Diagram

```
src/
├── App.jsx (~150 lines, simplified main component)
│
├── components/
│   ├── RegionSelector/
│   │   ├── RegionSelector.jsx (~50 lines)
│   │   └── RegionSelector.test.jsx (new)
│   │
│   ├── ModeSelector/
│   │   ├── ModeSelector.jsx (~130 lines)
│   │   └── ModeSelector.test.jsx (new)
│   │
│   ├── StatsView/
│   │   ├── StatsView.jsx (~110 lines)
│   │   └── StatsView.test.jsx (new)
│   │
│   ├── SettingsView/
│   │   ├── SettingsView.jsx (~90 lines)
│   │   └── SettingsView.test.jsx (new)
│   │
│   └── GameView/
│       ├── GameView.jsx (~280 lines)
│       ├── AudioPlayerSection.jsx (~75 lines)
│       ├── GuessesList.jsx (~35 lines)
│       ├── AnswerChoices.jsx (~30 lines)
│       ├── GameCompleted.jsx (~25 lines)
│       └── GameView.test.jsx (new)
│
├── hooks/
│   ├── usePersistence.js (~35 lines)
│   ├── useMigration.js (~20 lines)
│   ├── useShareResult.js (~20 lines)
│   ├── useGameInitialization.js (~25 lines)
│   ├── useGameNavigation.js (~200 lines)
│   ├── usePersistence.test.jsx (new)
│   ├── useMigration.test.jsx (new)
│   ├── useShareResult.test.jsx (new)
│   ├── useGameInitialization.test.jsx (new)
│   └── useGameNavigation.test.jsx (new)
│
└── utils/
    ├── CacheUtils.jsx (~150 lines, refactored)
    └── CacheUtils.test.jsx (new)
```

**Total lines added:** ~1,200 lines (new test files)
**Total lines removed from App.jsx:** ~550 lines
**Net reduction:** ~600 lines from App.jsx

---

## Dependency Graph (Ordered Extraction)

```
┌─────────────────────────────────────────────────────────────┐
│                    STEP 1: Custom Hooks                     │
│                                                              │
│  usePersistence ─────────────────────────────────┐           │
│  useMigration ───────────────────────────────────┤           │
│  useShareResult ──────────────────────────────────┤          │
│  useGameInitialization ───────────────────────────┤          │
│                                                         │       │
└─────────────────────────────────────────────────────────┼───────┘
                                                          │
┌─────────────────────────────────────────────────────────┼───────┐
│                STEP 2: Leaf Components                    │       │
│                                                          │       │
│  RegionSelector ─────────────────────────────────────────┤       │
│  ModeSelector ──────────────────────────────────────────┤       │
│  StatsView ─────────────────────────────────────────────┤       │
│  SettingsView ──────────────────────────────────────────┤       │
└─────────────────────────────────────────────────────────┼───────┘
                                                          │
┌─────────────────────────────────────────────────────────┼───────┐
│              STEP 3: GameView Sub-components              │       │
│                                                          │       │
│  AudioPlayerSection ─────────────────────────────────────┤       │
│  GuessesList ───────────────────────────────────────────┤       │
│  AnswerChoices ─────────────────────────────────────────┤       │
│  GameCompleted ──────────────────────────────────────────┤       │
└─────────────────────────────────────────────────────────┼───────┘
                                                          │
┌─────────────────────────────────────────────────────────┼───────┐
│                   STEP 4: GameView                        │       │
│                                                          │       │
│  GameView (depends on all sub-components) ───────────────┤       │
└─────────────────────────────────────────────────────────┼───────┘
                                                          │
┌─────────────────────────────────────────────────────────┼───────┐
│                STEP 5: useGameNavigation                 │       │
│                                                          │       │
│  useGameNavigation (depends on all components) ──────────┤       │
└─────────────────────────────────────────────────────────┼───────┘
                                                          │
┌─────────────────────────────────────────────────────────┼───────┐
│                   STEP 6: App.jsx                        │       │
│                                                          │       │
│  Refactor App.jsx to use all hooks and components ──────┘       │
└─────────────────────────────────────────────────────────────────┘
```

**Key Dependencies:**

- All hooks depend on existing utilities (no circular dependencies)
- All components depend on hooks, not each other (except GameView)
- GameView depends on its sub-components
- useGameNavigation depends on all components

---

## Test Strategy for Refactored Code

### Testing Philosophy

- **Unit Tests:** Test individual hooks and components in isolation
- **Integration Tests:** Test component composition and data flow
- **Snapshot Tests:** Capture UI output to prevent unintended changes
- **Mocking:** Mock all external dependencies (stores, API calls, localStorage)

### Custom Hook Testing Strategy

#### `usePersistence` Hook Tests

**File:** `src/hooks/usePersistence.test.jsx`

**Test Cases:**

1. Initialize selectedRegion from localStorage
2. Initialize lastPlayedMode from localStorage
3. Return correct state and setters
4. Handle missing localStorage gracefully

**Mocking Strategy:**

```javascript
// Mock localStorage
const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
global.localStorage = {
  getItem: mockGetItem,
  setItem: mockSetItem,
};
```

**Coverage Target:** 90%

#### `useMigration` Hook Tests

**File:** `src/hooks/useMigration.test.jsx`

**Test Cases:**

1. Call migrateFromOldFormat on normal store on mount
2. Call migrateFromOldFormat on hard store on mount
3. Log migration messages
4. Only run once (empty dependency array)

**Mocking Strategy:**

```javascript
// Mock Zustand stores
vi.mock("../stores/normalGameStore", () => ({
  useNormalGameStore: {
    getState: vi.fn(() => ({
      migrateFromOldFormat: vi.fn(),
    })),
  },
}));
```

**Coverage Target:** 85%

#### `useShareResult` Hook Tests

**File:** `src/hooks/useShareResult.test.jsx`

**Test Cases:**

1. Generate share text with currentDailyGame
2. Generate share text with todaysBird
3. Generate share text with selectedRegion
4. Call shareResult with generated text
5. Return early if currentDailyGame is null
6. Return early if todaysBird is null

**Mocking Strategy:**

```javascript
// Mock ShareUtils
vi.mock("../utils/ShareUtils", () => ({
  generateShareText: vi.fn(() => "mock share text"),
  shareResult: vi.fn(),
}));
```

**Coverage Target:** 90%

#### `useGameInitialization` Hook Tests

**File:** `src/hooks/useGameInitialization.test.jsx`

**Test Cases:**

1. Initialize game when selectedRegion and today exist
2. Initialize game when currentDailyGame is null
3. Not initialize if game already exists
4. Not initialize if selectedRegion is null
5. Set correct initial game state

**Mocking Strategy:**

```javascript
// Mock Zustand store
vi.mock("../stores/normalGameStore", () => ({
  useNormalGameStore: {
    getState: vi.fn(() => ({
      getDailyGame: vi.fn(() => null),
      setDailyGame: vi.fn(),
    })),
  },
}));
```

**Coverage Target:** 90%

#### `useGameNavigation` Hook Tests

**File:** `src/hooks/useGameNavigation.test.jsx`

**Test Cases:**

1. Return RegionSelector when selectedRegion is null
2. Return ModeSelector when currentView is MODE_SELECTOR
3. Return StatsView when currentView is STATS
4. Return SettingsView when currentView is SETTINGS
5. Return Practice mode when currentView is PRACTICE
6. Return Hard mode when currentView is HARD_MODE
7. Return GameView for any other view
8. Pass correct props to each component

**Mocking Strategy:**

```javascript
// Mock all components
vi.mock("../components/RegionSelector", () => ({
  RegionSelector: () => <div>RegionSelector</div>,
}));
vi.mock("../components/ModeSelector", () => ({
  ModeSelector: () => <div>ModeSelector</div>,
}));
// ... etc for all components
```

**Coverage Target:** 85%

---

### Component Testing Strategy

#### `RegionSelector` Component Tests

**File:** `src/components/RegionSelector/RegionSelector.test.jsx`

**Test Cases:**

1. Render all regions
2. Show "Played Today" badge for regions with guesses
3. Call onSelect with regionId when clicked
4. Match snapshot

**Mocking Strategy:**

```javascript
// Mock Zustand store
vi.mock("../../stores/normalGameStore", () => ({
  useNormalGameStore: {
    getState: vi.fn(() => ({
      getDailyGame: vi.fn(() => ({ guesses: [] })),
    })),
  },
}));
```

**Coverage Target:** 90%

#### `ModeSelector` Component Tests

**File:** `src/components/ModeSelector/ModeSelector.test.jsx`

**Test Cases:**

1. Render all game modes
2. Show "Last played" badge for lastPlayedMode
3. Call onSelect with mode when clicked
4. Call onSettings when settings button clicked
5. Show current region name
6. Match snapshot

**Mocking Strategy:** None (pure presentational)

**Coverage Target:** 90%

#### `StatsView` Component Tests

**File:** `src/components/StatsView/StatsView.test.jsx`

**Test Cases:**

1. Display overall stats (games played, win rate, avg guesses, streak)
2. Display region breakdown
3. Call onBack when back button clicked
4. Show "No games played" message when stats.totalGamesPlayed is 0
5. Match snapshot

**Mocking Strategy:** None (pure presentational with mock data)

**Coverage Target:** 90%

#### `SettingsView` Component Tests

**File:** `src/components/SettingsView/SettingsView.test.jsx`

**Test Cases:**

1. Display current region
2. Call onChangeRegion when "Change Region" clicked
3. Call onBack when back button clicked
4. Call onStats when "View Stats" clicked
5. Call resetTodaysGame when "Reset Today's Game" clicked
6. Call resetAllData when "Reset All Data" clicked
7. Call handleRefresh when "Refresh Game Data" clicked
8. Disable refresh button when refreshingData is true
9. Show update notification when hasUpdate is true
10. Match snapshot

**Mocking Strategy:** None (pure presentational with callbacks)

**Coverage Target:** 90%

#### `AudioPlayerSection` Component Tests

**File:** `src/components/GameView/AudioPlayerSection.test.jsx`

**Test Cases:**

1. Show audio selector when multiple recordings available
2. Call setSelectedAudioIndex when selection changed
3. Call toggleAudio when play/pause clicked
4. Show "Loading..." when loadingBird is true
5. Show "Pause" when isPlaying is true
6. Show "Play" when isPlaying is false
7. Show error message when audioError is true
8. Disable button when audioError or loadingBird is true
9. Match snapshot

**Mocking Strategy:**

```javascript
// Mock audio element
vi.mock("../../utils/AudioUtils", () => ({
  getAudioSrc: vi.fn((urls, index) => urls[index]),
}));
```

**Coverage Target:** 85%

#### `GuessesList` Component Tests

**File:** `src/components/GameView/GuessesList.test.jsx`

**Test Cases:**

1. Render all guesses
2. Show checkmark for correct guesses
3. Show X for incorrect guesses
4. Display bird name for each guess
5. Match snapshot

**Mocking Strategy:** None (pure presentational)

**Coverage Target:** 95%

#### `AnswerChoices` Component Tests

**File:** `src/components/GameView/AnswerChoices.test.jsx`

**Test Cases:**

1. Render all answer options
2. Show current guess count (e.g., "1/4")
3. Call onGuess with birdId when clicked
4. Display bird name and scientific name
5. Match snapshot

**Mocking Strategy:** None (pure presentational)

**Coverage Target:** 95%

#### `GameCompleted` Component Tests

**File:** `src/components/GameView/GameCompleted.test.jsx`

**Test Cases:**

1. Show "🎉 Well done!" when won is true
2. Show "😔 Better luck tomorrow!" when won is false
3. Render BirdCompletionCard with correct props
4. Call onShare when share button clicked
5. Match snapshot for both states

**Mocking Strategy:**

```javascript
// Mock BirdCompletionCard
vi.mock("../../utils/BirdCompletionCard", () => ({
  BirdCompletionCard: () => <div>BirdCompletionCard</div>,
}));
```

**Coverage Target:** 90%

#### `GameView` Component Tests

**File:** `src/components/GameView/GameView.test.jsx`

**Test Cases:**

1. Render audio player section
2. Render guesses list when guesses exist
3. Render answer choices when game not completed
4. Render game completed when game completed
5. Show hard mode warning when hardModeCompleted is true
6. Show data consistency error when dataConsistencyError exists
7. Call onChangeView when "Hard Mode" clicked
8. Call onChangeView when "Practice" clicked
9. Call onChangeView when "Change Mode" clicked
10. Call onChangeView when "Settings" clicked
11. Show "Update Available" badge when hasUpdate is true
12. Match snapshot

**Mocking Strategy:**

```javascript
// Mock all sub-components
vi.mock("./AudioPlayerSection", () => ({
  AudioPlayerSection: () => <div>AudioPlayerSection</div>,
}));
vi.mock("./GuessesList", () => ({
  GuessesList: () => <div>GuessesList</div>,
}));
// ... etc for all sub-components

// Mock Zustand stores
vi.mock("../../stores/hardModeStore", () => ({
  useHardModeStore: {
    getState: vi.fn(() => ({
      getHardModeGame: vi.fn(() => ({ completed: false })),
    })),
  },
}));
```

**Coverage Target:** 80%

---

### Integration Testing Strategy

#### App.jsx Integration Tests

**File:** `src/App.test.jsx` (update existing file)

**Test Cases:**

1. Full user flow: select region → select mode → play game → view stats
2. Migration runs on mount
3. Game initializes for today
4. Share functionality works end-to-end
5. View navigation works correctly
6. State persists across re-renders

**Mocking Strategy:**

```javascript
// Mock all hooks and components
vi.mock("./hooks/usePersistence", () => ({
  usePersistence: vi.fn(() => ({
    selectedRegion: "us",
    setSelectedRegion: vi.fn(),
    lastPlayedMode: "normal",
    setLastPlayedMode: vi.fn(),
  }),
}));
// ... mock all other hooks

// Mock all components
vi.mock("./components/RegionSelector", () => ({
  RegionSelector: () => <div data-testid="region-selector">RegionSelector</div>,
}));
// ... mock all other components
```

**Coverage Target:** 70% (integration tests cover flow, not branches)

---

### CacheUtils Refactoring Tests

#### CacheUtils Tests

**File:** `src/utils/CacheUtils.test.jsx` (new file)

**Test Cases:**

1. `getServiceWorker` returns null when service worker not supported
2. `getServiceWorker` returns registration when available
3. `checkDailyJsonUpdate` checks daily.json version
4. `checkForUpdates` checks all data files
5. `storeVersionInfo` stores last-modified and etag
6. `storeDailyJsonVersionInfo` stores version and date
7. `storeBirdsJsonVersionInfo` stores birds.json version
8. `checkBirdsJsonUpdate` checks birds.json version
9. `hasDateChanged` returns true when date changed
10. `hasDateChanged` returns true on error
11. `clearServiceWorkerCache` clears all caches
12. `refreshGameData` fetches all data files
13. `refreshGameData` throws error on failed fetch
14. `refreshGameData` calls onProgress callback

**Mocking Strategy:**

```javascript
// Mock navigator.serviceWorker
const mockRegistration = { foo: "bar" };
global.navigator.serviceWorker = {
  getRegistration: vi.fn(() => mockRegistration),
};

// Mock caches API
const mockCacheNames = ["cache-v1", "cache-v2"];
global.caches = {
  keys: vi.fn(() => mockCacheNames),
  delete: vi.fn(() => Promise.resolve()),
};

// Mock fetch
global.fetch = vi.fn((url) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: "mock" }),
    headers: {
      get: vi.fn((name) => (name === "last-modified" ? "12345" : "etag-123")),
    },
  }),
);

// Mock versionUtils
vi.mock("./versionUtils", () => ({
  checkDataFileUpdate: vi.fn(() => ({ hasUpdate: false })),
  storeDataFileVersion: vi.fn(),
  getCachedVersion: vi.fn(() => "cached"),
}));
```

**Coverage Target:** 85%

---

### Test Utilities and Fixtures

#### Test Fixtures

**File:** `tests/fixtures/gameState.js` (new file)

```javascript
// Mock game state for testing
export const mockGameState = {
  version: 2,
  dailyGames: {
    "us-2025-12-27": {
      region: "us",
      date: "2025-12-27",
      guesses: [
        { birdId: "amerob", correct: false, timestamp: Date.now() },
        { birdId: "robinsi", correct: true, timestamp: Date.now() },
      ],
      completed: true,
      won: true,
      maxGuesses: 4,
    },
  },
  stats: {
    totalGamesPlayed: 10,
    totalGamesWon: 7,
    currentStreak: 3,
    maxStreak: 5,
    averageGuesses: 2.5,
    regionStats: {
      us: {
        gamesPlayed: 10,
        gamesWon: 7,
        averageGuesses: 2.5,
      },
    },
  },
};

// Mock bird data
export const mockBird = {
  id: "amerob",
  name: "American Robin",
  scientificName: "Turdus migratorius",
  order: "Passeriformes",
  family: "Turdidae (Turdidae)",
  audioUrl: [
    "https://example.com/audio1.mp3",
    "https://example.com/audio2.mp3",
  ],
};

// Mock region data
export const mockRegion = {
  id: "us",
  name: "United States",
};

// Mock answer options
export const mockAnswerOptions = [
  mockBird,
  {
    id: "robinsi",
    name: "American Robin",
    scientificName: "Turdus migratorius",
    order: "Passeriformes",
    family: "Turdidae (Turdidae)",
    audioUrl: ["https://example.com/audio3.mp3"],
  },
  {
    id: "barswa",
    name: "Barn Swallow",
    scientificName: "Hirundo rustica",
    order: "Passeriformes",
    family: "Hirundinidae",
    audioUrl: ["https://example.com/audio4.mp3"],
  },
  {
    id: "blrjay",
    name: "Blue Jay",
    scientificName: "Cyanocitta cristata",
    order: "Passeriformes",
    family: "Corvidae",
    audioUrl: ["https://example.com/audio5.mp3"],
  },
];
```

#### Test Utilities

**File:** `tests/utils/testUtils.js` (new file)

```javascript
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Wrapper for components that need React Router
export function renderWithRouter(component) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

// Mock Zustand store
export function mockStore(storeName, mockState) {
  vi.mock(`../stores/${storeName}`, () => ({
    [storeName]: {
      getState: vi.fn(() => mockState),
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
  }));
}

// Create mock ref
export function createMockRef(currentValue = null) {
  return { current: currentValue };
}

// Mock audio element
export function mockAudioElement() {
  return {
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}
```

---

### Test Coverage Summary

| Module       | Target Coverage | Priority |
| ------------ | --------------- | -------- |
| Custom Hooks | 85-90%          | High     |
| Components   | 80-95%          | High     |
| Integration  | 70%             | Medium   |
| CacheUtils   | 85%             | Medium   |
| **Overall**  | **80%**         | **High** |

---

### Test Execution Strategy

#### Pre-Extraction Tests

1. Write integration tests for current App.jsx
2. Ensure all existing tests pass
3. Establish baseline coverage

#### During Extraction

1. Write tests for new hook/component BEFORE extracting
2. Extract code
3. Verify tests still pass
4. Run full test suite

#### Post-Extraction

1. Run full test suite
2. Check coverage meets targets
3. Manual smoke testing
4. Update test fixtures if needed

---

### Test Files to Create

**Custom Hooks:**

- `src/hooks/usePersistence.test.jsx` (new)
- `src/hooks/useMigration.test.jsx` (new)
- `src/hooks/useShareResult.test.jsx` (new)
- `src/hooks/useGameInitialization.test.jsx` (new)
- `src/hooks/useGameNavigation.test.jsx` (new)

**Components:**

- `src/components/RegionSelector/RegionSelector.test.jsx` (new)
- `src/components/ModeSelector/ModeSelector.test.jsx` (new)
- `src/components/StatsView/StatsView.test.jsx` (new)
- `src/components/SettingsView/SettingsView.test.jsx` (new)
- `src/components/GameView/AudioPlayerSection.test.jsx` (new)
- `src/components/GameView/GuessesList.test.jsx` (new)
- `src/components/GameView/AnswerChoices.test.jsx` (new)
- `src/components/GameView/GameCompleted.test.jsx` (new)
- `src/components/GameView/GameView.test.jsx` (new)

**Utilities:**

- `src/utils/CacheUtils.test.jsx` (new)

**Fixtures:**

- `tests/fixtures/gameState.js` (new)
- `tests/utils/testUtils.js` (new)

**Total New Test Files:** 18 files
**Estimated Test Lines:** ~2,500 lines

---

## Next Steps

1. **Create test fixtures and utilities**
2. **Write integration tests for current App.jsx**
3. **Start extraction** with lowest-risk components first
4. **Write tests for each new module BEFORE extracting**
5. **Run full test suite** after each extraction step
6. **Update documentation** as extraction progresses
