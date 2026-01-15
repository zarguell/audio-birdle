# Architecture

**Analysis Date:** 2026-01-15

## Pattern Overview

**Overall:** Static Client-Side React Application with Python Data Processing Pipeline

**Key Characteristics:**
- Monolithic static web application (no server-side rendering)
- Clear separation between frontend React app and backend Python scripts
- Fully static architecture with no database
- Client-side state management via localStorage
- Deterministic daily bird selection via hash-based algorithm

## Layers

**Presentation Layer (React/Vite):**
- Purpose: User interface and interaction handling
- Contains: React components, view routing, audio playback controls
- Location: `src/main.jsx`, `src/App.jsx`, `src/utils/*.jsx` components
- Depends on: Business Logic Layer for game mechanics, Data Layer for JSON files
- Used by: End users in web browser

**Business Logic Layer (Utility Modules):**
- Purpose: Core game mechanics, state management, data processing
- Contains: Game state management, guess processing, daily bird selection, taxonomic comparison
- Location: `src/utils/GameLogic.jsx`, `src/utils/DailyBirdUtils.jsx`, `src/utils/TaxonomyUtils.jsx`, `src/utils/AudioUtils.jsx`
- Depends on: Data Layer (LoadGameData), Storage Layer (StorageUtils)
- Used by: Presentation Layer (App.jsx)

**Data Layer (Static JSON + Python Processing):**
- Purpose: Data storage and processing pipeline
- Contains: Static JSON files (birds, regions, daily challenges), Python data processing scripts
- Location: `public/data/*.json`, `scripts/*.py`
- Depends on: eBird API (external service)
- Used by: Business Logic Layer (LoadGameData fetches JSON)

**Infrastructure Layer (Testing & Deployment):**
- Purpose: Quality assurance and deployment automation
- Contains: Test suites, CI/CD workflows, deployment configuration
- Location: `tests/`, `.github/workflows/`, `wrangler.jsonc`
- Depends on: All layers for testing and deployment
- Used by: Development workflow and CI/CD pipeline

## Data Flow

**Initial Application Load:**

1. User navigates to site
2. Browser loads `src/main.jsx` (React entry point)
3. `main.jsx` renders `src/App.jsx` with StrictMode
4. `App.jsx` calls `loadGameData()` from `src/utils/LoadGameData.jsx`
5. `loadGameData()` fetches static JSON files from `/data/*.json`
6. Data loaded into React state, UI renders with game options

**Daily Challenge Gameplay:**

1. `App.jsx` calls `loadDailyBirdData()` from `src/utils/DailyBirdUtils.jsx`
2. `DailyBirdUtils` parses `daily.json` for current date/region
3. Hash-based lookup retrieves answer bird from bird list
4. User selects bird (multiple choice or free-text)
5. `App.jsx` calls `processGuess()` from `src/utils/GameLogic.jsx`
6. Game state updated in localStorage via `src/utils/StorageUtils.jsx`
7. UI re-renders with feedback (correct/incorrect, statistics)

**Data Update Pipeline:**

1. GitHub Actions triggers `scripts/generate-daily-birds.py` (cron: 4 AM UTC)
2. Python script fetches eBird API data via `scripts/ebird-*.py`
3. Script generates new daily.json with hashed bird ID
4. Script commits changes to repository
5. Deployed to Cloudflare Workers via GitHub Actions

**Audio Playback:**

1. User clicks play button
2. `src/utils/AudioUtils.jsx` creates audio controls
3. HTML5 Audio API plays sound from URL
4. Dead URLs tracked in localStorage for future exclusion

**State Management:**
- Client-side localStorage - No persistent in-memory state
- Each game session independent
- State versioning supports migrations (version 2 format)

## Key Abstractions

**GameLogic (Service-like Utility):**
- Purpose: Core game mechanics and state management
- Location: `src/utils/GameLogic.jsx`
- Examples: `processGuess()`, `createInitialGameState()`, `calculateStats()`
- Pattern: Stateless functions with React state integration

**DailyBirdUtils (Hash-based Selection):**
- Purpose: Deterministic daily bird selection
- Location: `src/utils/DailyBirdUtils.jsx`
- Examples: `loadDailyBirdData()`, `getDailyBirdId()`, `hashBirdId()`
- Pattern: Hash-based lookup with fallback to seeded random selection

**LoadGameData (Data Fetching):**
- Purpose: Fetch and cache static JSON data
- Location: `src/utils/LoadGameData.jsx`
- Examples: `loadGameData()`, `loadRegionData()`, `forceRefresh()`
- Pattern: Async fetching with retry logic and cache validation

**StorageUtils (Persistence):**
- Purpose: localStorage wrapper with error handling
- Location: `src/utils/StorageUtils.jsx`
- Examples: `loadState()`, `saveState()`, `migrateState()`
- Pattern: Safe localStorage operations with JSON parsing

**AudioUtils (Media Controls):**
- Purpose: Audio playback and dead URL tracking
- Location: `src/utils/AudioUtils.jsx`
- Examples: `createAudioControls()`, `trackDeadURL()`
- Pattern: HTML5 Audio API wrapper with error handling

## Entry Points

**React Application Entry:**
- Location: `src/main.jsx`
- Triggers: Browser loads the application
- Responsibilities: Initialize React app, render App component with StrictMode

**Main Application Component:**
- Location: `src/App.jsx`
- Triggers: Mounted by main.jsx
- Responsibilities: View routing, game state orchestration, data loading, audio playback

**Python Data Processing Scripts:**
- Location: `scripts/generate-daily-birds.py`, `scripts/game-data-generator.py`
- Triggers: GitHub Actions cron job or manual execution
- Responsibilities: Fetch eBird data, generate JSON files, update daily challenges

**Development Server:**
- Location: Vite dev server (configured in `vite.config.js`)
- Triggers: `npm run dev`
- Responsibilities: Hot module reloading, development build

## Error Handling

**Strategy:** Try/catch at data loading boundaries, graceful degradation

**Patterns:**
- localStorage operations wrapped in try/catch with error logging
- Audio playback failures tracked and excluded from future attempts
- Data fetching with retry logic in `LoadGameData.jsx`
- Silent failures for non-critical features (e.g., audio playback)
- Console errors for debugging, no user-facing error messages

## Cross-Cutting Concerns

**Hash Consistency:**
- Identical hashing algorithm in Python (`scripts/generate-daily-birds.py`) and JavaScript (`src/utils/HashUtils.jsx`)
- Shared secret salt (`"birdle-salt-2025"`) for deterministic selection
- Critical for daily challenge consistency

**State Persistence:**
- All game state stored in localStorage via StorageUtils
- State versioning supports automatic migrations
- Separate storage for normal mode, hard mode, and practice mode

**Data Freshness:**
- Background cache validation in `LoadGameData.jsx`
- Force refresh option for users
- Daily automated updates via GitHub Actions

**Testing:**
- Comprehensive mocking of browser APIs (localStorage, Audio, fetch)
- Shared fixtures in `tests/conftest.py` for Python tests
- Smart test selection in CI based on commit patterns

---

*Architecture analysis: 2026-01-15*
*Update when major patterns change*
