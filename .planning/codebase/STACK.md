# Technology Stack

**Analysis Date:** 2026-01-15

## Languages

**Primary:**
- JavaScript/JSX - React application code (`.jsx` files in `src/`)

**Secondary:**
- Python 3.x - Backend data processing scripts (`.py` files in `scripts/`)

## Runtime

**Environment:**
- Node.js - React application runtime
- Python 3.x - Data processing script runtime
- Browser - Client-side execution with localStorage persistence

**Package Manager:**
- npm - JavaScript package management (`package.json`, `package-lock.json`)
- pip - Python package management (implied from Python scripts)

## Frameworks

**Core:**
- React 19.1.0 - UI framework
- Vite 7.3.1 - Build tool and development server
- Tailwind CSS 4.1.18 - Utility-first CSS framework
- PostCSS 8.5.4 - CSS processing

**Testing:**
- Vitest 4.0.16 - JavaScript testing framework with jsdom environment
- pytest - Python testing framework
- React Testing Library - React component testing

**Build/Dev:**
- ESLint 9.39.2 - JavaScript linting
- Pylint - Python linting
- Autoprefixer 10.4.21 - CSS vendor prefixing

## Key Dependencies

**Critical:**
- react-dom@19.2.0 - React DOM rendering
- @vitejs/plugin-react@5.0.0 - Vite React plugin
- lucide-react@0.562.0 - Icon library
- sonner@2.0.7 - Toast notifications
- jsdom@27.4.0 - DOM mocking for tests

**Infrastructure:**
- pandas, requests, beautifulsoup4, selenium - Python data processing
- python-dotenv - Environment variable management

## Configuration

**Environment:**
- `EBIRD_API_KEY` - eBird API access (stored as environment variable)
- No .env.example file present (security concern)

**Build:**
- `vitest.config.js` - Vitest test configuration
- `pyproject.toml` - pytest configuration
- `wrangler.jsonc` - Cloudflare Workers deployment
- `.pre-commit-config.yaml` - Pre-commit hooks (gitleaks, ESLint, pylint)

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js and Python 3.x)
- Selenium WebDriver for audio scraping scripts

**Production:**
- Cloudflare Workers - Static asset hosting
- No server-side requirements (fully static site)

---

*Stack analysis: 2026-01-15*
*Update after major dependency changes*
