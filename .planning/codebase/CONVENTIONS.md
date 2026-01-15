# Coding Conventions

**Analysis Date:** 2026-01-15

## Naming Patterns

**Files:**
- PascalCase.jsx - React components and utilities (e.g., `GameLogic.jsx`, `DailyBirdUtils.jsx`)
- kebab-case.py - Python scripts (e.g., `generate-daily-birds.py`, `ebird-region.py`)
- *.test.jsx - JavaScript test files (e.g., `GameLogic.test.jsx`)
- test_*.py - Python test files (e.g., `test_game_data_generator.py`)

**Functions:**
- camelCase - JavaScript functions (e.g., `processGuess`, `loadGameData`, `createInitialGameState`)
- snake_case - Python functions (e.g., `hash_bird_id`, `generate_daily_birds`)

**Variables:**
- camelCase - JavaScript variables (e.g., `dailyGames`, `regionStats`, `currentStreak`)
- snake_case - Python variables (e.g., `bird_id`, `hash_value`, `api_response`)

**Constants:**
- UPPER_SNAKE_CASE - Both languages (e.g., `MAX_GUESSES`, `SECRET_SALT`, `HARD_MODE_MAX_GUESSES`)

**Types/Interfaces:**
- PascalCase - TypeScript/JavaScript types (e.g., `GameState`, `DailyGame`, `Bird`)

## Code Style

**Formatting:**
- 2-space indentation for both JavaScript and Python
- Double quotes for JavaScript/JSX strings
- Single quotes for Python strings (double quotes for strings with single quotes)
- No semicolons in JavaScript (modern style)
- Opening braces on same line for functions and control structures

**Linting:**
- ESLint 9.39.2 - JavaScript linting (configured in `.pre-commit-config.yaml`)
- Pylint - Python linting (configured in `.pre-commit-config.yaml`)
- Run: `npm run lint` (JavaScript), `pylint scripts/` (Python)
- Pre-commit hooks enforce linting before commits

## Import Organization

**Order:**
1. External packages (react, lodash, etc.)
2. Internal modules (./utils, ../components)
3. Type imports (if using TypeScript)

**Grouping:**
- No explicit blank line groups observed
- Imports appear at top of files in logical order

**Path Aliases:**
- No path aliases configured (all imports are relative or from node_modules)

## Error Handling

**Patterns:**
- Try/catch blocks for localStorage operations, data fetching, audio playback
- Console error logging for debugging
- Graceful degradation for non-critical features
- Silent failures for audio playback errors (tracked but not shown to user)

**Error Types:**
- No custom error classes defined
- Generic Error objects thrown
- Errors logged with context before throwing

**Logging:**
- Console errors for exceptions
- Console warnings for non-critical issues
- No structured logging framework

## Logging

**Framework:**
- Console API (console.log, console.error, console.warn)
- No external logging library (pino, winston, etc.)

**Patterns:**
- Log at service boundaries (data loading, game logic)
- Log errors with context (error messages include what failed)
- No user-facing error messages (all logging to console)

## Comments

**When to Comment:**
- Explain why, not what (business logic, algorithms, edge cases)
- Document complex game mechanics (daily bird selection, hash consistency)
- Explain non-obvious workarounds

**JSDoc/TSDoc:**
- Used for public API functions in utilities
- Format: Basic JSDoc with parameter descriptions
- Not exhaustive (used for complex functions only)

**TODO Comments:**
- Not extensively used (codebase is relatively mature)
- Format: `// TODO: description` or `// FIXME: description`

## Function Design

**Size:**
- Varies widely (some files large like `CacheUtils.jsx` at 299 lines)
- No strict size limit enforced
- Large files indicate potential refactoring opportunity

**Parameters:**
- Multiple parameters common (no strict limit of 3)
- Object parameters used for complex data (e.g., game state objects)
- Destructuring used for object parameters

**Return Values:**
- Explicit returns (no implicit undefined)
- Early returns for guard clauses common
- Null/undefined returned for error cases

## Module Design

**Exports:**
- Named exports preferred (most utilities export multiple functions)
- Default exports for React components
- No barrel files (index.ts) pattern used

**Barrel Files:**
- Not used (each file imported directly)

**Dependencies:**
- Utilities import from each other as needed
- Circular dependencies avoided (clear hierarchy)
- Constants imported from `Constants.jsx` by many modules

---

*Convention analysis: 2026-01-15*
*Update when patterns change*
