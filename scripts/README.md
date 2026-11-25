# Audio-Birdle Scripts Documentation

## 📚 Documentation

This directory contains scripts for fetching and processing bird data from eBird. For comprehensive documentation, see:

- **[WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md)** - Complete workflow documentation with detailed explanations
  - Architecture and data flow
  - Step-by-step region onboarding guide
  - Complete script reference
  - Troubleshooting guide
  - Improvement roadmap

- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - One-page cheat sheet
  - Workflow diagram
  - Common commands
  - Quick troubleshooting
  - Performance tips


> **Cache-safety step:** after any change under `public/data/`, regenerate the
> SHA-256 manifest so browsers never mix old and new data:
>
> ```bash
> python3 -m sitegen manifest --data-dir public/data
> ```
>
> The daily-update workflow does this automatically.

## 🚀 Quick Start

### Prerequisites

```bash
# Setup Python environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install pandas requests beautifulsoup4 selenium python-dotenv

# Get eBird API key from https://ebird.org/api/keygen
echo "EBIRD_API_KEY=your_key_here" > .env

# Get a free Xeno-canto API key (register at https://xeno-canto.org,
# verify your email, then copy the key from https://xeno-canto.org/account)
echo "XC_API_KEY=your_xc_key" >> .env
```

### Basic Workflow

```bash
# 1. Get global taxonomy (run once)
python3 ebird-taxonomy.py --fmt json --output data/ebird-taxonomy.json

# 2. Get region species list
python3 ebird-region.py --region US --output data/regions/us.json

# 3. Filter taxonomy for region
python3 ebird-filter-region.py data/regions/us.json data/ebird-taxonomy.json --exclude-hybrids

# 4. Get subregions (states/provinces)
python3 ebird-generate-subregions.py --region US --output data/regions/us-subregions.json

# 5. FETCH AUDIO URLS + METADATA (Xeno-canto API v3, ~15 min for 700 species)
#    The old Selenium scraper (ebird-songdownload.py) no longer works:
#    eBird/Macaulay media search now requires CAS login.
python3 xc-audio-fetch.py data/regions/us-taxonomy.json --country US --tag song --max-urls 10

# 6. Generate game data (URL records from xc-audio-fetch.py become
#    per-clip attribution objects: recordist, license, quality, ...)
python3 game-data-generator.py --region US \
  --taxonomy data/regions/us-taxonomy.json \
  --urls data/regions/us-taxonomy-urls.json \
  --output ../public/data/birds.json

# Output includes placeholder fields for:
# - images: Bird photos with attribution
# - facts: Educational information
# - learnMoreUrl: External resource links
# - audioUrl[].attribution: Recording credits

# 7. Generate subregion bird data
python3 generate-daily-region-data.py \
  data/regions/us-subregions.json \
  ../public/data/daily-subregion-birds.json

# 7b. OPTIONAL: enhance the shipped birds.json in place instead of
#     regenerating from scratch (keeps existing species + ML clips,
#     adds learn-more links + fun facts from local data, and merges
#     xc-audio-fetch.py clips with attribution where coverage is thin)
python3 enhance-bird-data.py ../public/data/birds.json \
  --subregions ../public/data/daily-subregion-birds.json \
  --xc-urls data/regions/us-taxonomy-urls.json
#     Facts combine subregion prevalence with family context
#     ("Recorded in 31 of 51 US states/provinces - a member of the
#     thrush family (Turdidae)."). Use --dry-run first to preview
#     the summary. Guarded by tests/integration/test_data_pipeline_integration.py.

# 8. Generate daily challenges (automated via GitHub Actions)
python3 generate-daily-birds.py --days 7 \
  --subregions ../public/data/daily-subregion-birds.json
```

## 📖 Script Reference

### Data Fetching (API-based, fast)

| Script                                                         | Purpose                 | Time |
| -------------------------------------------------------------- | ----------------------- | ---- |
| [ebird-taxonomy.py](./ebird-taxonomy.py)                       | Fetch global taxonomy   | 30s  |
| [ebird-region.py](./ebird-region.py)                           | Get region species list | 5s   |
| [ebird-generate-subregions.py](./ebird-generate-subregions.py) | Get subregions          | 5s   |

### Data Processing

| Script                                                           | Purpose          | Time |
| ---------------------------------------------------------------- | ---------------- | ---- |
| [ebird-filter-region.py](./ebird-filter-region.py)               | Filter taxonomy  | 10s  |
| [game-data-generator.py](./game-data-generator.py)               | Merge game data  | 30s  |
| [generate-daily-region-data.py](./generate-daily-region-data.py) | Subregion birds  | 10s  |
| [generate-daily-birds.py](./generate-daily-birds.py)             | Daily challenges | 30s  |

### Audio Fetching (API-based)

| Script                                           | Purpose                      | Time    |
| ------------------------------------------------ | ---------------------------- | ------- |
| [xc-audio-fetch.py](./xc-audio-fetch.py)         | Fetch audio URLs + metadata  | ~15 min |
| [ebird-songdownload.py](./ebird-songdownload.py) | **Deprecated** (login-gated) | —       |

### Utilities

| Script                                                     | Purpose               |
| ---------------------------------------------------------- | --------------------- |
| [verify_hash_consistency.py](./verify_hash_consistency.py) | Test hash consistency |

## ⚠️ Important Notes

### Audio Source

Audio URLs and metadata come from the [Xeno-canto API v3](https://xeno-canto.org/explore/api)
(free key required, set `XC_API_KEY`). Quality rating, recordist, license, date
and background species flow into `birds.json` per clip via
`game-data-generator.py`.

The previous approach (`ebird-songdownload.py`, Selenium scraping of the
eBird/Macaulay catalog) stopped working: media search results are now gated
behind CAS login for anonymous clients, and the site sits behind Anubis
proof-of-work bot protection. The script is kept for reference only.

### Current Status

- ✅ **Supported Regions**: US, US-Lower48 (virtual region)
- ⚠️ **Scaling**: Audio scraping must be done manually for each new region
- 🔄 **Daily Updates**: Automated via GitHub Actions (4 AM UTC)

## 🎯 Common Tasks

### Add a New Region

See [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md#complete-workflow-adding-a-new-region) for complete step-by-step instructions.

### Update Daily Challenges

```bash
python3 generate-daily-birds.py --days 7 \
  --subregions ../public/data/daily-subregion-birds.json
```

### Verify Hash Consistency

```bash
python3 verify_hash_consistency.py
npm test -- hash-consistency
```

## 🔧 Troubleshooting

See [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md#troubleshooting) for detailed troubleshooting guide.

Quick fixes:

- **ChromeDriver error**: `brew install chromedriver` (macOS) or `sudo apt-get install chromium-chromedriver` (Linux)
- **API rate limiting**: Add delays between requests
- **Hash mismatch**: Run `verify_hash_consistency.py` and check salt value
- **Region not showing**: Check `public/data/regions.json` and restart dev server

## 📋 Roadmap

See [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md#roadmap-for-improvements) for detailed improvement roadmap.

**High Priority**:

- Replace Selenium scraping with API-based approach
- Implement parallel processing for faster scraping
- Build community-sourced audio database

**Medium Priority**:

- Automated region onboarding script
- Data validation and quality checks
- Incremental updates (don't re-scrape everything)

## 📚 Additional Resources

- **eBird API Documentation**: https://documenter.getpostman.com/view/664302/S1ENRW51
- **Get eBird API Key**: https://ebird.org/api/keygen
- **Region Codes**: https://ebird.org/region
- **ChromeDriver**: https://chromedriver.chromium.org/

## 📖 Quick Command Examples

### Get eBird Taxonomy

```bash
# JSON format
python3 ebird-taxonomy.py --fmt json --output data/ebird-taxonomy.json

# CSV format
python3 ebird-taxonomy.py --fmt csv --output data/ebird-taxonomy.csv
```

### Get Regions

```bash
python3 ebird-region.py --region US --output data/regions/us.json
```

### Filter Taxonomy for a Region

```bash
python ebird-filter-region.py data/regions/us.json data/ebird-taxonomy.json --exclude-hybrids
# Output: data/regions/us-taxonomy.json
```

### Scrape Audio URLs ⚠️

```bash
# Songs for US region
python3 xc-audio-fetch.py data/regions/us-taxonomy.json --country US --tag song --max-urls 10

# Calls for EU region
python3 xc-audio-fetch.py data/regions/eu-taxonomy.json --country "United Kingdom" --tag call --max-urls 10
```

### Generate Game Data

```bash
python3 game-data-generator.py \
  --region US \
  --taxonomy data/regions/us-taxonomy.json \
  --urls data/regions/us-taxonomy-urls.json \
  --output ../public/data/birds.json
```

### Generate Subregions

```bash
python3 ebird-generate-subregions.py --region US --output data/regions/us-subregions.json
```

### Generate Daily Region Data

```bash
python3 generate-daily-region-data.py \
  data/regions/us-subregions.json \
  ../public/data/daily-subregion-birds.json
```

### Generate Daily Challenges

```bash
# Default: today, avoid repeats for 7 days
python3 generate-daily-birds.py --days 7 \
  --subregions ../public/data/daily-subregion-birds.json

# Specific date
python3 generate-daily-birds.py --date 2025-01-05 --days 7
```

---

For detailed documentation, see [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) and [QUICK_REFERENCE.md](./QUICK_REFERENCE.md).

## Auditing a candidate country

Before adding a country, run the read-only audit. It fetches the eBird species
and subregion lists, filters the local taxonomy, removes rare vagrants, and
checks Xeno-canto audio coverage with the same quality/length rules as the
production pipeline.

```bash
python3 region-audit.py --region CA --output region-audits/ca.json
```

By default the candidate pool is limited to species reported in the last 14
days with **at least 5 valid observations on at least 5 distinct days** in a
subregion. This keeps one-day twitches and rare vagrants out of the audio
readiness check. Use `--regular-days 0` to audit every eBird species instead,
or tune `--regular-min-observations` / `--regular-min-days`.

That 14-day pool is seasonal. Before shipping a region, build its year-round
filter so summer migrants and winter visitors are not lost:

```bash
python3 build-regular-pool.py --region GB \
  --subregions-file data/regions/gb-subregions.json \
  --output data/regions/gb-regular-species.json
```

It samples a short window in each of the last 12 months. The daily generator
automatically reads `<region>-regular-species.json` from the same directory as
the subregion file and keeps only its species.

The default gate is **50% audio coverage of the regular pool**, **at least 150
playable species**, and at least 10 playable regular species in every
subregion. Override it for a stricter pilot:

```bash
python3 region-audit.py --region GB \
  --min-quality B \
  --target-coverage 60 \
  --min-playable-species 250 \
  --min-playable-per-subregion 30 \
  --output region-audits/gb.json
```

For a quick structural check without calling Xeno-canto:

```bash
python3 region-audit.py --region CA --skip-audio \
  --species-file path/to/ca-species.json \
  --subregions-file path/to/ca-subregions.json
```

The JSON report includes the regular pool by subregion, missing-audio species,
quality/license counts, playable species per subregion, and a `ready` flag. It
does not modify `public/data/`.

Requires `EBIRD_API_KEY` and `XC_API_KEY` in `.env` for the full audio audit.
The 14-day observation fetch is also used for the regular-species filter, so it
needs `EBIRD_API_KEY` even when `--skip-audio` is set (unless
`--regular-days 0` is used).
