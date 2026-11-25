# Audio-Birdle Project Overview

Context for AI agents working on this project.

## Project Overview

Audio-Birdle is a web-based bird identification game inspired by Wordle. Players
listen to bird songs and guess the correct species. It is a fully static site:
Python renders Jinja pages at build time, then vanilla ES modules run in the
browser. There is no React, no bundler, and no client-side build step.

### Game modes

- **Normal:** daily challenge, 4 multiple-choice options, 4 guesses.
- **Hard:** daily challenge, free-text autocomplete, 6 guesses, progressive
  taxonomic hints (order → family → genus).
- **Practice:** unlimited rounds; normal or hard mechanics; no stats persistence.

### Stack

| Layer | Choice |
|---|---|
| Site generator | Python 3 + Jinja2 (`sitegen/`) |
| Browser | Vanilla ES modules, no runtime framework |
| Styles | Hand-written mobile-first CSS with a warm paper / pixel-nature theme |
| Data pipeline | Python 3, pandas, requests, BeautifulSoup, Selenium |
| Hosting | Cloudflare Workers static assets only |
| Tests | pytest, Node `node:test`, Playwright |

### Visual system

- Warm parchment panels on a pixel-art dawn chorus scene.
- Wood-framed HUD controls, hard offset shadows, square corners.
- Vendored **VT323** display font (`sitegen/static/fonts/`) plus system mono UI.
- Original SVG scene art: `sitegen/static/img/forest-scene.svg` and
  `bird-mark.svg`.
- Fonts and Forever components are SHA/commit pinned in `sitegen/vendor/` and
  documented in `THIRD_PARTY_NOTICES.md`.

## Repository Structure

```
sitegen/
├── build.py                 Render pages, hash assets, write data manifest
├── data.py                  Validate committed JSON data
├── data_manifest.py         SHA-256 data manifest
├── cli.py                   build / manifest / serve commands
├── templates/
│   ├── base.html            Head, header, tab bar, toast template
│   ├── macros.html          Inline SVG icon macro and nav helpers
│   └── pages/               home, play, game, stats, archive, settings, 404
├── static/
│   ├── css/                 tokens, base, layout, components, game, pages,
│   │                        animations
│   ├── fonts/               vendored VT323 woff2
│   ├── img/                 original SVG scene art + bird mark
│   └── js/
│       ├── app.js           Region chrome, jelly-button feedback
│       ├── core/            constants, dates, storage, data, hash, taxonomy,
│       │                    answers, daily, gameState, practice, audio, share
│       ├── ui/              autocomplete, completion, countdown, gameView,
│       │                    guessList, refresh, toast
│       └── pages/           one small entry point per page
└── vendor/                  Pinned Forever AI Components provenance + license

public/
├── data/                    Generated game data + manifest.json
├── _headers                 CSP and Cloudflare cache rules
└── audio-birdle.svg

scripts/                     Data acquisition and generation pipeline
tests/
├── test_*.py                Python unit tests (data + sitegen)
├── integration/             Python data pipeline integration
├── js/                      Node unit tests for browser modules
└── e2e/                     Playwright browser + live-site tests

dist/                        Generated site (gitignored)
```

## Site Generator

### Build pipeline

`bash scripts/build-site.sh` (or `python -m sitegen build` when Jinja is
already installed):

1. Validates every required data file (`sitegen/data.py`).
2. Copies `public/` into `dist/` (data, `_headers`, icon).
3. Copies `sitegen/static/` into `dist/assets/<build-id>/`, where `build-id` is
   a SHA-256 prefix of the static tree. CSS/JS URLs therefore change whenever
   their content changes.
4. Renders every page with Jinja. HTML must reference assets through
   `{{ asset_base }}`.
5. Writes `dist/data/manifest.json` with a SHA-256 for every data file.
6. Writes `version.json`, `sitemap.xml`, `robots.txt`, and `build-summary.json`.

### Rules

- **No HTML in Python.** All markup lives in `sitegen/templates/`.
- **No inline scripts or styles.** JavaScript and CSS live in
  `sitegen/static/` and are linted. This keeps CSP at `script-src 'self'` and
  `style-src 'self'`.
- **No monolithic page scripts.** Shared behavior belongs in `core/` or `ui/`;
  page entry points only orchestrate.
- **Templates use `<template>` elements** for repeated DOM fragments
  (guess rows, answer options, archive entries, toasts, stats cards). Avoid
  building HTML strings in JavaScript.
- **Use `textContent`**, never `innerHTML`, for data-derived text.

### Adding a page

1. Add a route to `PAGES` and a script name to `SCRIPTS` in `sitegen/build.py`.
2. Add `sitegen/templates/pages/<name>.html` extending `base.html` and set
   `page_script`.
3. Add `sitegen/static/js/pages/<name>.js`; import shared modules, call
   `initPage()`, and keep the file small.
4. Add page-specific styles to `sitegen/static/css/pages.css` or a focused file
   linked from `base.html`.
5. Add a pytest build assertion in `tests/test_sitegen_build.py` and an E2E
   test if it has behavior.

### Using Forever AI Components

The project adapts selected patterns from
[`isas1/forever-ai-components`](https://github.com/isas1/forever-ai-components)
(MIT). The pinned upstream revision and adapted files are recorded in
`sitegen/vendor/forever-components.json`; the license is alongside it and in
`THIRD_PARTY_NOTICES.md`. Renovate tracks the pinned commit but does **not**
automerge it.

When adapting a component:

- Extract its CSS into a lintable file under `sitegen/static/css/`.
- Remove idle/auto-replay loops and theme-broadcast hooks.
- Preserve `prefers-reduced-motion` handling and namespaced class prefixes
  where practical.
- Update the provenance JSON and notices.
- Never ship the upstream HTML or inline scripts.

## Cache Strategy (Important)

Cloudflare static assets and browser caches can otherwise mix old and new data.

- `public/_headers` sets:
  - HTML and data manifest: `no-cache` / `no-store`.
  - `/assets/*`: one-year `immutable` (URL contains a content hash).
  - `/data/*`: one-year `immutable`; the client only requests data through
    `?v=<sha256-prefix>` from the manifest.
- `sitegen/static/js/core/data.js` fetches `/data/manifest.json?t=...` with
  `cache: "no-store"`, then fetches each file with `?v=<hash>`.
- If the fetched file's SHA-256 does not match the manifest, the manifest is
  refreshed and the file is retried with a cache-busting query. Never remove
  this verification.
- The daily-update workflow runs `python -m sitegen manifest --data-dir
  public/data` after generating data. A deploy must never publish data without
  its manifest.
- There is no service worker. Do not add one without revisiting this strategy.

## Game State

Persisted key: `audio-birdle-game`, version 2. The envelope matches the former
Zustand format so existing players keep their games and stats:

```js
{
  version: 2,
  state: {
    dailyGames: {
      "us-2026-11-24-normal": {
        region: "us",
        date: "2026-11-24",
        mode: "normal",
        guesses: [{ birdId, correct, timestamp }],
        completed: true,
        won: true,
        maxGuesses: 4,
        statsApplied: true
      }
    },
    stats: {
      totalGamesPlayed: 1,
      totalGamesWon: 1,
      currentStreak: 1,
      maxStreak: 1,
      regionStats: {
        us: { gamesPlayed, gamesWon, totalGuesses, averageGuesses }
      }
    }
  }
}
```

- `statsApplied` prevents resetting a completed daily game and replaying it
  from double-counting stats.
- Legacy keys are migrated: `audio-birdle-game-state` (v0 single game /
  v1 multi-game), `audio-birdle-normal-game`, and `audio-birdle-hard-mode`.
- Region and last-mode keys remain `audio-birdle-region`,
  `audio-birdle-region-name`, and `audio-birdle-last-mode`.

## Canonical Hash

The DJB2 variant must remain identical in Python and JavaScript.

- Formula: `hash = ((hash << 5) - hash) + char_code`, 32-bit unsigned.
- Sugar: `hashString()` in `sitegen/static/js/core/hash.js`.
- Bird IDs: `hashBirdId(id) = hashString(`${id}-birdle-salt-2025`)`.
- Python: `hash_bird_id()` in `scripts/generate-daily-birds.py`.
- Output: exactly 8 lowercase hex characters.
- Test vector: `amerob` → `104c723e`.

Never change the algorithm without updating both implementations, all test
vectors, `daily.json`, and `history.json`.

## Data Pipeline

Critical scripts:

- `scripts/generate-daily-birds.py` — deterministic daily answers, no repeats
  within `--days`, subregion-aware selection, history/daily JSON.
- `scripts/generate-daily-region-data.py` — eBird observations per subregion.
- `scripts/game-data-generator.py` — birds.json from taxonomy + audio metadata.
- `scripts/enhance-bird-data.py`, `xc-audio-fetch.py`, and the `ebird-*`
  scripts — supporting acquisition tools.

The daily workflow `.github/workflows/daily-update.yml`:

1. Fetches observations for every subregion.
2. Generates daily birds.
3. Regenerates `public/data/manifest.json`.
4. Runs generator tests against real data.
5. Commits and pushes. Cloudflare rebuilds from `main`.

Data files are generated; do not hand-edit `public/data/*.json`.

## Region expansion

Add countries one at a time, not as one giant dataset. Run the read-only audit
first:

```bash
python scripts/region-audit.py --region CA --output region-audits/ca.json
```

The default pilot gate is **50% of species-level eBird species** and **at least
300 playable species**; override with `--target-coverage` and
`--min-playable-species`. Review missing-audio species, Xeno-canto errors, and
subregion coverage before generating production data.

After a country passes:

1. Generate its taxonomy, subregions, and Xeno-canto URL records.
2. Generate `birds.json` for the region.
3. Add its subregion file so the daily workflow fetches it.
4. Add the region to `public/data/regions.json`.
5. Regenerate `public/data/manifest.json`.
6. Add region-specific data-invariant tests.

`birds.json` is currently one file for all regions. Before expanding beyond
roughly four countries, split it into per-region shards and make the client
load only the selected region.

## Testing

Run the full suite:

```bash
pip install -r requirements-dev.txt
npm ci
python -m playwright install chromium
make test
```

Individual layers:

```bash
pytest tests/ -m "not e2e and not live" -v   # Python, coverage gate 70%
node --test tests/js/*.test.js               # browser module unit tests
pytest tests/e2e -m "not live" -v --no-cov    # local built site
LIVE_SITE_URL=... pytest tests/e2e/test_live_site.py -m live --no-cov
```

CI is `.github/workflows/smart-test.yml`; it selects lint/tests/build based on
changed paths and commit title. `live-site.yml` verifies the deployed site on a
schedule.

### Test landmarks

- `tests/test_sitegen_build.py` — pages, hashed assets, no inline code,
  manifest hashes, `_headers`, version output.
- `tests/js/gameState.test.js` — v2 envelope, stats once, legacy migration.
- `tests/e2e/test_cache_consistency.py` — manifest-pinned requests, cache
  headers, CSP, no service worker.
- `tests/e2e/test_normal_game.py`, `test_hard_game.py`, `test_practice.py`,
  `test_settings.py` — real browser flows.

## Commands

```bash
make serve                  # Build + serve at 127.0.0.1:8000
make build                  # Render dist/ via scripts/build-site.sh
make manifest               # Regenerate public/data/manifest.json
make lint                   # ESLint + Stylelint
npm run test:js             # Node unit tests
pytest tests/ -m "not e2e and not live" -v
pytest tests/e2e -m "not live" -v --no-cov
```

Python lint: `pylint scripts/*.py sitegen/*.py --errors-only`.
Template lint: `djlint sitegen/templates --check --lint`.
CSS: `npm run lint:css`. JS: `npm run lint:js`.

## Commit Message Conventions

The smart-test workflow classifies PR titles / commit messages:

- `Update challenge: ...` — daily data update (game logic tests).
- `Update dependency ...` / `chore(deps): ...` — dependency checks.
- `feat: ...` — full suite.
- `fix: ...` — integration + build + browser tests.
- `chore: ...` — minimal lint/build.
- Other / merge — standard build verification.

## Security

- CSP and security headers are in `public/_headers`.
- All rendered URLs are limited to `https:` in `core/data.js`.
- Never use `innerHTML` for data-derived content.
- Do not add inline scripts/styles; CSP forbids them.
- eBird API keys come from GitHub secrets / `.env` and are never committed.
- gitleaks runs in pre-commit.
