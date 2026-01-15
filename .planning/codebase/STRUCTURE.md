# Codebase Structure

**Analysis Date:** 2026-01-15

## Directory Layout

```
audio-birdle/
├── src/                    # React application source code
│   ├── main.jsx           # React application entry point
│   ├── App.jsx            # Main application component
│   └── utils/            # Utility modules (14 files)
├── scripts/              # Python data processing scripts
│   ├── generate-daily-birds.py      # Daily challenge generation
│   ├── game-data-generator.py        # Game data JSON creation
│   ├── ebird-*.py                   # eBird API integration (5 files)
│   └── ebird-generate-subregions.py # Subregion definitions
├── public/               # Static assets
│   └── data/           # Game data JSON files
├── tests/               # Test suite (157 tests)
│   ├── setup.js        # Vitest setup with mocks
│   ├── conftest.py     # Pytest fixtures
│   ├── unit/           # JavaScript unit tests
│   └── fixtures/       # Test data fixtures
├── .github/workflows/   # CI/CD automation
├── .planning/          # Project planning documents
├── [config files]      # Various configuration files
└── README.md           # User documentation
```

## Directory Purposes

**src/**

- Purpose: React application source code
- Contains: `.jsx` files for components and utilities
- Key files: `main.jsx` (entry point), `App.jsx` (main component), `src/utils/` (game logic)
- Subdirectories: `src/utils/` (14 utility modules)

**src/utils/**

- Purpose: Core game logic, data management, and React components
- Contains: Game state, data loading, audio controls, taxonomic utilities
- Key files: `GameLogic.jsx`, `DailyBirdUtils.jsx`, `AudioUtils.jsx`, `LoadGameData.jsx`, `StorageUtils.jsx`
- Subdirectories: None (flat structure)

**scripts/**

- Purpose: Python data processing scripts for eBird API integration
- Contains: `.py` files for data fetching, processing, and JSON generation
- Key files: `generate-daily-birds.py`, `game-data-generator.py`, `ebird-taxonomy.py`, `ebird-region.py`
- Subdirectories: None (flat structure)

**public/**

- Purpose: Static assets served directly
- Contains: `index.html`, `data/` directory
- Key files: `index.html` (HTML entry point), `data/*.json` (game data)

**public/data/**

- Purpose: Static JSON data files consumed by React app
- Contains: Bird data, regions, daily challenges, history
- Key files: `birds.json`, `daily.json`, `regions.json`, `history.json`, `daily-subregion-birds.json`
- Subdirectories: None (flat structure)

**tests/**

- Purpose: Test suite for JavaScript and Python code
- Contains: Unit tests, integration tests, fixtures, setup files
- Key files: `setup.js` (Vitest mocks), `conftest.py` (pytest fixtures)
- Subdirectories: `tests/unit/utils/` (JS unit tests), `tests/fixtures/` (test data)

**.github/workflows/**

- Purpose: CI/CD automation for testing and deployment
- Contains: GitHub Actions workflow files
- Key files: `smart-test.yml` (intelligent test selection), `daily-update.yml` (daily challenge generation)
- Subdirectories: None

## Key File Locations

**Entry Points:**

- `src/main.jsx` - React application initialization
- `src/App.jsx` - Main application component and view router
- `public/index.html` - HTML entry point

**Configuration:**

- `package.json` - npm dependencies and scripts
- `vite.config.js` - Vite build tool configuration
- `pyproject.toml` - pytest configuration
- `wrangler.jsonc` - Cloudflare Workers deployment config
- `.pre-commit-config.yaml` - Pre-commit hooks (gitleaks, ESLint, pylint)

**Core Logic:**

- `src/utils/GameLogic.jsx` - Game state management and guess processing
- `src/utils/DailyBirdUtils.jsx` - Daily bird selection and hashing
- `src/utils/TaxonomyUtils.jsx` - Taxonomic comparison for hard mode
- `src/utils/AudioUtils.jsx` - Audio playback controls
- `src/utils/LoadGameData.jsx` - Data fetching and caching
- `src/utils/StorageUtils.jsx` - localStorage wrapper

**Testing:**

- `tests/setup.js` - Vitest environment setup with mocks
- `tests/unit/utils/` - JavaScript unit tests for utilities
- `tests/conftest.py` - Pytest fixtures for Python tests
- `tests/test_generate_daily_birds.py` - Daily generation tests
- `tests/test_game_data_generator.py` - Data generator tests

**Documentation:**

- `README.md` - User-facing documentation
- `AGENTS.md` - Project context for AI agents

## Naming Conventions

**Files:**

- PascalCase.jsx - React components and utilities (e.g., `GameLogic.jsx`, `DailyBirdUtils.jsx`)
- kebab-case.py - Python scripts (e.g., `generate-daily-birds.py`, `ebird-taxonomy.py`)
- \*.test.jsx - JavaScript test files (e.g., `GameLogic.test.jsx`)
- test\_\*.py - Python test files (e.g., `test_generate_daily_birds.py`)
- UPPERCASE.md - Important documentation (README, AGENTS, CHANGELOG)

**Directories:**

- kebab-case - All directories (e.g., `src/utils/`, `public/data/`)
- Plural for collections - `scripts/`, `tests/`, `workflows/`, `fixtures/`

**Special Patterns:**

- `*.jsx` - All JavaScript/React files
- `*.py` - All Python scripts
- `*.json` - Data and configuration files
- `*.config.*` - Configuration files (e.g., `vitest.config.js`)

## Where to Add New Code

**New Feature (React):**

- Primary code: `src/utils/[FeatureName].jsx`
- Tests: `tests/unit/utils/[FeatureName].test.jsx`
- If large: Split into multiple focused utilities

**New Feature (Python Data Processing):**

- Primary code: `scripts/[feature-name].py`
- Tests: `tests/test_[feature_name].py`

**New React Component:**

- Implementation: `src/utils/[ComponentName].jsx`
- Tests: `tests/unit/utils/[ComponentName].test.jsx`

**New Game Mode:**

- Logic: `src/utils/[ModeName]Game.jsx` (e.g., `HardModeGame.jsx`, `PracticeGame.jsx`)
- State: Separate storage keys in `src/utils/StorageUtils.jsx`
- Tests: `tests/unit/utils/[ModeName]Game.test.jsx`

**New Utility Functions:**

- Implementation: `src/utils/[UtilityName].jsx` or add to existing utility file
- Tests: `tests/unit/utils/[UtilityName].test.jsx`

**New Data Pipeline Script:**

- Implementation: `scripts/[script-name].py`
- Tests: `tests/test_[script_name].py`
- Integration: Add to `scripts/generate-daily-birds.py` or create separate workflow

## Special Directories

**public/data/**

- Purpose: Static JSON game data files
- Source: Generated by Python scripts in `scripts/`
- Committed: Yes (source of truth for production data)
- Regeneration: Automated via GitHub Actions (daily) or manual

**.planning/**

- Purpose: Project planning and documentation
- Source: Manually created during development
- Committed: Yes
- Contains: Codebase analysis, project plans, roadmaps

**tests/fixtures/**

- Purpose: Shared test data for JavaScript and Python tests
- Source: Manually created sample data
- Committed: Yes
- Used by: Test files for consistent test data

---

_Structure analysis: 2026-01-15_
_Update when directory structure changes_
