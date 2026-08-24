# Audio-Birdle Scripts: Comprehensive Workflow Documentation

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites & Setup](#prerequisites--setup)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [Complete Workflow: Adding a New Region](#complete-workflow-adding-a-new-region)
5. [Script Reference](#script-reference)
6. [Roadmap for Improvements](#roadmap-for-improvements)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The scripts in this directory automate the process of fetching bird data from eBird, processing audio URLs, and generating game data for the Audio-Birdle application. The workflow transforms raw eBird API data into the structured JSON files consumed by the frontend game.

### Key Characteristics

- **Manual Bottleneck**: Audio URL scraping requires browser automation (Selenium) - this is the primary reason scaling to new regions is difficult
- **Once Audio is Scraped**: The rest of the pipeline is fully automated and API-based
- **Hash-Based Daily Selection**: Bird answers are selected deterministically using hash functions
- **Multi-Region Support**: Can handle multiple regions with subregion-level filtering

### Current Status

- ✅ **Supported Regions**: United States (US), US Lower 48 (virtual region)
- ⚠️ **Scaling Limitation**: Audio URL scraping must be done manually for each new region
- 🔄 **Daily Updates**: Automated via GitHub Actions (generates daily challenges at 4 AM UTC)

---

## Prerequisites & Setup

### 1. Environment Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install pandas requests beautifulsoup4 selenium python-dotenv

# Install ChromeDriver (required by Selenium)
# macOS:
brew install chromedriver

# Linux:
sudo apt-get install chromium-chromedriver

# Windows:
# Download from https://chromedriver.chromium.org/
# Add to PATH
```

### 2. eBird API Key

**Required for**: All scripts that interact with eBird API

```bash
# Create .env file in scripts/ directory
cd scripts
touch .env

# Add your API key (get from https://ebird.org/api/keygen)
echo "EBIRD_API_KEY=your_api_key_here" > .env
```

**How to get an API key**:

1. Visit https://ebird.org/api/keygen
2. Sign in to your eBird account
3. Request an API key
4. Copy the key to your `.env` file

### 3. Directory Structure

The scripts expect the following directory structure:

```
scripts/
├── data/
│   ├── ebird-taxonomy.json     # Full global taxonomy
│   ├── ebird-taxonomy.csv      # CSV version of taxonomy
│   └── regions/                # Region-specific data
│       ├── us.json             # Species codes for US
│       ├── us-taxonomy.json    # Filtered taxonomy for US
│       ├── us-taxonomy-urls.json  # Scraped audio URLs
│       ├── us-subregions.json  # US states/provinces
│       └── us-lower48-subregions.json  # Virtual region subregions
├── *.py                        # Python scripts
└── .env                        # API keys (not in git)

public/data/
├── birds.json                  # Final game data (all regions)
├── regions.json                # Region metadata
├── daily.json                  # Daily challenge answers
├── history.json                # Bird selection history
└── daily-subregion-birds.json  # Subregion bird lists
```

---

## Architecture & Data Flow

### High-Level Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 1: Base Data                       │
│  (Run once for global dataset, then reuse for all regions)      │
└─────────────────────────────────────────────────────────────────┘

  1. Fetch Global Taxonomy
     ebird-taxonomy.py
     ↓
     ebird-taxonomy.json (8.8MB, all world species)

┌─────────────────────────────────────────────────────────────────┐
│                      PHASE 2: Region Setup                     │
│  (Run once per new region)                                      │
└─────────────────────────────────────────────────────────────────┘

  2. Get Region Species List
     ebird-region.py --region US
     ↓
     regions/us.json (species codes)

  3. Filter Taxonomy for Region
     ebird-filter-region.py regions/us.json ebird-taxonomy.json
     ↓
     regions/us-taxonomy.json (species with taxonomy details)

  4. Generate Subregions
     ebird-generate-subregions.py --region US
     ↓
     regions/us-subregions.json (states/provinces)

┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 3: Audio Scraping                     │
│  ⚠️ MANUAL BOTTLENECK - Requires browser automation            │
│  (Run once per region per audio type: songs, calls)            │
└─────────────────────────────────────────────────────────────────┘

  5. Scrape Audio URLs
     xc-audio-fetch.py regions/us-taxonomy.json --tag song --country US
     ↓
     [Selenium opens Chrome browser]
     [Navigates eBird media catalog for each species]
     [Extracts audio URLs from page source]
     ↓
     regions/us-taxonomy-urls.json (1.8MB, scraped URLs)

  **NOTE**: This step is MANUAL and TIME-CONSUMING
  - Chrome browser window opens and performs visible scraping
  - Rate limiting may be needed to avoid blocking
  - Must be repeated for each region and audio type (song, call)

┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 4: Game Data Generation              │
│  (Run once per region, then update as needed)                  │
└─────────────────────────────────────────────────────────────────┘

  6. Generate Game Data
     game-data-generator.py --region US \
       --taxonomy regions/us-taxonomy.json \
       --urls regions/us-taxonomy-urls.json \
       --output ../public/data/birds.json
     ↓
     public/data/birds.json (region with audio URLs)

  7. Generate Daily Region Data
     generate-daily-region-data.py regions/us-subregions.json \
       ../public/data/daily-subregion-birds.json
     ↓
     public/data/daily-subregion-birds.json (subregion bird lists)

┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 5: Daily Operations                   │
│  (Automated via GitHub Actions, runs daily at 4 AM UTC)        │
└─────────────────────────────────────────────────────────────────┘

  8. Generate Daily Challenge
     generate-daily-birds.py --days 7 \
       --subregions ../public/data/daily-subregion-birds.json
     ↓
     public/data/dirdaily.json (today's answers)
     public/data/history.json (selection history)
```

### Data Transformations

**Taxonomy Entry** → **Game Bird Entry**:

```json
// Input: ebird-taxonomy.json
{
  "speciesCode": "amerob",
  "comName": "American Robin",
  "sciName": "Turdus migratorius",
  "order": "Passeriformes",
  "familyComName": "Turdidae (Turdidae)",
  "familySciName": "Turdidae"
}

// Output: birds.json
{
  "id": "amerob",
  "name": "American Robin",
  "scientificName": "Turdus migratorius",
  "order": "Passeriformes",
  "family": "Turdidae (Turdidae)",
  "audioUrl": [
    {
      "url": "https://cdn.download.earth.ebird.org/...",
      "attribution": {
        "recordist": "John Doe",
        "location": "New York, NY",
        "date": "2024-03-15"
      }
    }
  ],
  "images": [
    {
      "url": "https://example.com/images/robin.jpg",
      "attribution": {
        "photographer": "Jane Smith",
        "source": "Macaulay Library",
        "license": "CC BY-NC 4.0"
      }
    }
  ],
  "facts": "The American Robin is a familiar songbird known for its orange-red breast and cheerful morning song.",
  "learnMoreUrl": "https://birdsoftheworld.org/species/american-robin"
}
```

---

## Complete Workflow: Adding a New Region

### Example: Adding Europe (EU) Support

#### Step 1: Fetch Region Species List

```bash
cd scripts

# Fetch all species observed in Europe
python3 ebird-region.py --region EU --output data/regions/eu.json

# Output: data/regions/eu.json
# Content: Array of species codes (e.g., ["barswa", "commer", ...])
```

**What this does**:

- Calls eBird API: `https://api.ebird.org/v2/product/spplist/EU`
- Returns list of all species ever observed in Europe
- Saves as JSON array of species codes

**Time**: ~5 seconds

#### Step 2: Filter Global Taxonomy

```bash
# Filter full taxonomy to only include European species
python3 ebird-filter-region.py data/regions/eu.json data/ebird-taxonomy.json --exclude-hybrids

# Output: data/regions/eu-taxonomy.json
# Content: Full taxonomy entries for European species only
```

**What this does**:

- Loads global taxonomy (8.8MB)
- Filters to only include species codes in eu.json
- Removes hybrid species if `--exclude-hybrids` flag is used
- Preserves all taxonomy fields (order, family, scientific names)

**Time**: ~10 seconds

#### Step 3: Generate Subregions

```bash
# Get list of European countries/provinces
python3 ebird-generate-subregions.py --region EU --output data/regions/eu-subregions.json

# Output: data/regions/eu-subregions.json
# Content: Array of subregion objects with code, name
```

**What this does**:

- Calls eBird API: `https://api.ebird.org/v2/ref/region/list/subnational1/EU`
- Returns list of countries/provinces in Europe region
- Used for subregion-specific daily challenges

**Time**: ~5 seconds

#### Step 4: ⚠️ Scrape Audio URLs (MANUAL BOTTLENECK)

```bash
# SCRAPING AUDIO URLS - REQUIRES BROWSER AUTOMATION
# This step will open a visible Chrome window and may take several hours

# For songs
python3 xc-audio-fetch.py \
  data/regions/eu-taxonomy.json \
  --region EU \
  --tag song \
  --max-urls 10

# For calls (optional)
python3 xc-audio-fetch.py \
  data/regions/eu-taxonomy.json \
  --region EU \
  --tag call \
  --max-urls 10
```

**What this does**:

1. Opens Chrome browser via Selenium
2. For each species in eu-taxonomy.json:
   - Navigates to eBird media catalog page
   - Clicks "Load More" button up to `--max-urls` times
   - Extracts URLs for individual audio pages
3. For each audio page URL:
   - Navigates to page
   - Parses HTML to find `<audio>` or `<video>` src
   - Saves URL if found
4. Outputs JSON with columns: code, page Url, audio Url

**⚠️ IMPORTANT NOTES**:

- **VISUAL PROCESS**: Chrome window will be visible and perform actions
- **TIME CONSUMING**: For Europe (~500 species), expect 2-4 hours
- **RATE LIMITING**: eBird may block if too many requests too quickly
- **REQUIRES ATTENTION**: May need to restart if crashes/errors occur
- **NETWORK DEPENDENT**: Requires stable internet connection

**Sample output**:

```json
[
  {
    "code": "barswa",
    "page Url": "https://media.ebird.org/catalog?...",
    "audio Url": "https://cdn.download.earth.ebird.org/..."
  }
]
```

**Troubleshooting scraping**:

- If Chrome crashes: Restart script, it will resume
- If blocked: Wait 1-2 hours, add delays between requests
- If missing URLs: Some species don't have audio recordings

**Time**: 2-4 hours for full region (500+ species)

#### Step 5: Generate Game Data

```bash
# Combine taxonomy and audio URLs into game data
python3 game-data-generator.py \
  --region EU \
  --taxonomy data/regions/eu-taxonomy.json \
  --urls data/regions/eu-taxonomy-urls.json \
  --output ../public/data/birds.json
```

**What this does**:

- Loads taxonomy (species info)
- Groups audio URLs by species code
- Merges data together
- Only includes birds that have audio URLs
- Appends to existing birds.json (supports multiple regions)

**Output structure**:

```json
{
  "us": [...],      // Existing US birds
  "eu": [           // New EU birds
    {
      "id": "barswa",
      "name": "Barn Swallow",
      "scientificName": "Hirundo rustica",
      "order": "Passeriformes",
      "family": "Hirundinidae (Hirundinidae)",
      "audioUrl": [
        {
          "url": "https://cdn.download.earth.ebird.org/...",
          "attribution": {
            "recordist": "Recordist Name",
            "location": "Location",
            "date": "YYYY-MM-DD"
          }
        }
      ],
      "images": [
        {
          "url": "https://example.com/image.jpg",
          "attribution": {
            "photographer": "Photographer Name",
            "source": "Source Name",
            "license": "CC BY-NC 4.0"
          }
        }
      ],
      "facts": "Short educational fact about the bird...",
      "learnMoreUrl": "https://external-source.org/species/..."
    }
  ]
}
```

**Time**: ~30 seconds

#### Step 6: Add Region to Game Configuration

Edit `public/data/regions.json`:

```json
[
  { "id": "us", "name": "United States", "country": "US" },
  {
    "id": "us-lower48",
    "name": "US Lower 48",
    "country": "US",
    "parentRegion": "us",
    "excludedSubregions": ["Alaska", "Hawaii"]
  },
  { "id": "eu", "name": "Europe", "country": "EU" }
]
```

#### Step 7: Generate Subregion Bird Data

```bash
# Fetch recent observations for a random subregion
python3 generate-daily-region-data.py \
  data/regions/eu-subregions.json \
  ../public/data/daily-subregion-birds.json
```

**What this does**:

- Randomly selects a subregion (e.g., "France")
- Fetches recent observations from eBird API
- Extracts unique species codes
- Adds to daily-subregion-birds.json for subregion filtering

**Output structure**:

```json
{
  "us": {
    "Minnesota": [{"id": "amerob"}, ...]
  },
  "eu": {
    "France": [{"id": "barswa"}, ...]
  }
}
```

**Time**: ~10 seconds

#### Step 8: Test the New Region

```bash
# Start development server
cd ..
npm run dev

# In browser, test the EU region
# - Check that birds load correctly
# - Verify audio plays
# - Test daily challenge generation
```

#### Step 9: Deploy

```bash
# Commit new data files
git add public/data/birds.json public/data/regions.json public/data/daily-subregion-birds.json
git commit -m "feat: Add Europe region support"

# Push to trigger deployment
git push origin main
```

---

## Script Reference

### Data Fetching Scripts

#### `ebird-taxonomy.py`

Fetches global eBird taxonomy (all bird species worldwide).

**Usage**:

```bash
python3 ebird-taxonomy.py --fmt json --output data/ebird-taxonomy.json
python3 ebird-taxonomy.py --fmt csv --output data/ebird-taxonomy.csv
```

**Options**:

- `--fmt`: Output format (json or csv)
- `--output`: Output file path
- `--version`: Taxonomy version (optional)
- `--category`: Taxonomic category filter (optional)
- `--species`: Specific species code (optional)

**API Endpoint**: `https://api.ebird.org/v2/ref/taxonomy/ebird`

**Output**: Full taxonomy with fields:

- speciesCode, comName, sciName
- order, familyComName, familySciName
- category, taxonOrder
- bandingCodes, comNameCodes, sciNameCodes

**Frequency**: Run once to get base data, update quarterly

**Time**: ~30 seconds

---

#### `ebird-region.py`

Fetches list of species for a specific region.

**Usage**:

```bash
python3 ebird-region.py --region US --output data/regions/us.json
python3 ebird-region.py --region EU --output data/regions/eu.json
```

**Options**:

- `--region`: Region code (required)
  - Examples: US, CA, MX, EU, GB, AU
  - Full list: https://ebird.org/region
- `--output`: Output file path

**API Endpoint**: `https://api.ebird.org/v2/product/spplist/{region}`

**Output**: JSON array of species codes

```json
["amerob", "mallar3", "barswa", ...]
```

**Frequency**: Run once per region

**Time**: ~5 seconds

---

#### `ebird-generate-subregions.py`

Fetches subregions (states/provinces) for a country region.

**Usage**:

```bash
python3 ebird-generate-subregions.py --region US --output data/regions/us-subregions.json
```

**Options**:

- `--region`: Country region code (required)
- `--output`: Output file path

**API Endpoint**: `https://api.ebird.org/v2/ref/region/list/subnational1/{region}`

**Output**: Array of subregion objects

```json
[
  {"code": "US-AL", "name": "Alabama"},
  {"code": "US-AK", "name": "Alaska"},
  ...
]
```

**Frequency**: Run once per region

**Time**: ~5 seconds

---

### Data Processing Scripts

#### `ebird-filter-region.py`

Filters global taxonomy to only include species from a specific region.

**Usage**:

```bash
python3 ebird-filter-region.py \
  data/regions/us.json \
  data/ebird-taxonomy.json \
  --exclude-hybrids
```

**Options**:

- `region_file`: Path to region species list JSON (required)
- `taxonomy_file`: Path to full taxonomy JSON (required)
- `--exclude-hybrids`: Remove hybrid species from output

**Output**: Filtered taxonomy (e.g., `data/regions/us-taxonomy.json`)

**Frequency**: Run once per region

**Time**: ~10 seconds

---

#### `game-data-generator.py`

Merges taxonomy and audio URL data into final game data format.

**Usage**:

```bash
python3 game-data-generator.py \
  --region US \
  --taxonomy data/regions/us-taxonomy.json \
  --urls data/regions/us-taxonomy-urls.json \
  --output ../public/data/birds.json
```

**Options**:

- `--region`: Region code (required)
- `--taxonomy`: Path to region taxonomy JSON (required)
- `--urls`: Path to audio URLs JSON (required)
- `--output`: Output file path (required)

**Process**:

1. Groups audio URLs by species code
2. Matches with taxonomy entries
3. Filters out birds without audio
4. Merges into existing birds.json

**Frequency**: Run once per region or when updating audio URLs

**Time**: ~30 seconds

---

### Audio Scraping Scripts

#### `xc-audio-fetch.py` (API-based; ebird-songdownload.py deprecated: ML login-gated)

Scrapes audio URLs from eBird website using Selenium browser automation.

**Usage**:

```bash
python3 xc-audio-fetch.py \
  data/regions/us-taxonomy.json \
  --region US \
  --tag song \
  --max-urls 10
```

**Options**:

- `taxonomy_file`: Path to region taxonomy JSON (required)
- `--region`: Region code for media catalog (default: US)
- `--tag`: Media tag to filter by (default: song)
  - Options: song, call, flight-call, etc.
- `--max-urls`: Maximum URLs per species (default: 10)

**Output**: `{input-filename}-urls.json`

```json
[
  {
    "code": "amerob",
    "page Url": "https://media.ebird.org/catalog...",
    "audio Url": "https://cdn.download.earth.ebird.org/..."
  }
]
```

**Process**:

1. Opens Chrome browser
2. For each species:
   - Constructs URL: `https://media.ebird.org/catalog?tag=song&regionCode=US&taxonCode=amerob`
   - Navigates to page
   - Clicks "Load More" button up to max-urls times
   - Extracts individual audio page URLs
3. For each audio page:
   - Navigates to page
   - Parses HTML for `<audio>` or `<video>` src
   - Saves URL

**Requirements**:

- Chrome browser installed
- ChromeDriver installed and in PATH
- Stable internet connection
- Patience (2-4 hours for 500+ species)

**⚠️ Issues & Limitations**:

- **Slow**: Each page load takes 1-3 seconds
- **Visible**: Browser window visible during scraping
- **Fragile**: eBird HTML changes may break scraper
- **Rate Limited**: Too many requests may trigger blocking
- **Manual**: Requires monitoring and potential restarts

**Frequency**: Run once per region per audio type

**Time**: 2-4 hours for 500+ species

---

### Daily Generation Scripts

#### `generate-daily-region-data.py`

Fetches recent bird observations for a subregion to populate daily challenge data.

**Usage**:

```bash
python3 generate-daily-region-data.py \
  data/regions/us-subregions.json \
  ../public/data/daily-subregion-birds.json
```

**Options**:

- `subregions_file`: Path to subregions JSON (required)
- `output_file`: Output file path (required)

**Process**:

1. Randomly selects one subregion from list
2. Fetches recent observations from eBird API
3. Extracts unique species codes
4. Appends to daily-subregion-birds.json

**API Endpoint**: `https://api.ebird.org/v2/data/obs/{subregion}/recent`

**Output**:

```json
{
  "us": {
    "Minnesota": [{ "id": "amerob" }, { "id": "barswa" }]
  }
}
```

**Frequency**: Run daily (automated via GitHub Actions)

**Time**: ~10 seconds

---

#### `generate-daily-birds.py`

Generates daily challenge answers for all regions, avoiding recent repeats.

**Usage**:

```bash
python3 generate-daily-birds.py \
  --days 7 \
  --subregions ../public/data/daily-subregion-birds.json

# For a specific date
python3 generate-daily-birds.py \
  --date 2025-01-05 \
  --days 7 \
  --subregions ../public/data/daily-subregion-birds.json
```

**Options**:

- `--days`: Days to avoid repeating birds (default: 7)
- `--date`: Target date YYYY-MM-DD (default: today)
- `--subregions`: Path to subregion birds JSON

**Process**:

1. Loads birds.json, history.json, regions.json
2. For each region:
   - Detects virtual regions (e.g., US-Lower48)
   - Selects random subregion if subregions provided
   - Filters birds by subregion
   - Excludes birds used in last N days
   - Selects random bird from remaining
   - Hashes bird ID using deterministic algorithm
3. Updates daily.json and history.json

**Hash Function** (must match JavaScript):

```python
def hash_bird_id(bird_id):
    combined = f"{bird_id}-birdle-salt-2025"
    hash_value = 0
    for char in combined:
        hash_value = ((hash_value << 5) - hash_value) + ord(char)
        hash_value = hash_value & 0xFFFFFFFF
    return format(hash_value & 0xFFFFFFFF, "08x")[:8]
```

**Output**:

- `daily.json`: Today's answers (hashed)
  ```json
  [
    {
      "date": "2025-01-05",
      "region": "us",
      "answerHash": "a1b2c3d4",
      "subregion": "Minnesota"
    }
  ]
  ```
- `history.json`: Full history (unhashed)
  ```json
  {
    "us": [
      {
        "date": "2025-01-05",
        "id": "amerob",
        "name": "American Robin",
        "subregion": "Minnesota"
      }
    ]
  }
  ```

**Virtual Region Support**:

- Detects regions with `parentRegion` field
- Uses parent region's bird list
- Excludes specified subregions
- Example: US-Lower48 uses US birds, excludes Alaska and Hawaii

**Frequency**: Run daily (automated via GitHub Actions at 4 AM UTC)

**Time**: ~30 seconds

---

#### `verify_hash_consistency.py`

Utility script to generate test hashes for verifying Python-JavaScript consistency.

**Usage**:

```bash
python3 verify_hash_consistency.py
```

**Output**: List of bird IDs and their hashes for testing

**Purpose**: Ensures Python and JavaScript hash functions produce identical outputs

---

## Roadmap for Improvements

### High Priority: Remove Manual Bottleneck

#### 1. Replace Selenium Scraping with API-Based Approach

**Problem**: Current audio URL scraping requires browser automation and takes 2-4 hours per region.

**Proposed Solutions**:

**Option A: Direct Audio API Access**

- Research if eBird has undocumented audio API endpoints
- Check if audio URLs follow predictable patterns
- Investigate XHR calls made by eBird website
- **Effort**: Medium
- **Impact**: Eliminates scraping entirely

**Option B: Batch Download with Parallel Processing**

- Use asyncio or multiprocessing for concurrent scraping
- Implement smart retry logic with exponential backoff
- Add progress checkpointing to resume after failures
- **Effort**: Low
- **Impact**: Reduces time from 4 hours to ~30 minutes

**Option C: Community-Sourced Audio Database**

- Build shared database of scraped audio URLs
- Users can contribute their region's data
- Import/export functionality
- **Effort**: Medium
- **Impact**: Scales to unlimited regions through community effort

**Option D: Alternative Audio Sources**

- Xeno-Canto.org (has documented API)
- Macaulay Library (Cornell)
- Wikimedia Commons bird audio
- **Effort**: High
- **Impact**: Better audio quality, documented APIs

---

### Medium Priority: Enhanced Automation

#### 2. End-to-End Region Onboarding Script

**Create**: `add-region.sh` or `add-region.py`

**Features**:

- Single command to add new region
- Automated error checking
- Progress tracking and logging
- Dry-run mode for testing
- Rollback capability

**Example Usage**:

```bash
python3 add-region.py --region EU --audio-types song,call
```

**Steps Automated**:

1. Fetch region species list
2. Filter taxonomy
3. Generate subregions
4. Scrape audio URLs
5. Generate game data
6. Update configuration files
7. Run validation tests
8. Generate summary report

---

#### 3. Data Validation & Quality Checks

**Add**: `validate-data.py`

**Checks**:

- All birds have required fields (id, name, scientificName, order, family, audioUrl)
- Audio URLs are accessible (HTTP HEAD requests)
- Image URLs are accessible (if provided)
- No duplicate species codes within region
- Hash consistency between Python and JavaScript
- Region coverage (e.g., "Europe should have 500+ species")
- Attribution fields are properly formatted
- Facts and learnMoreUrl fields are valid (if provided)

**Usage**:

```bash
python3 validate-data.py --region EU
```

---

#### 4. Incremental Updates

**Problem**: Currently must re-scrape all audio URLs even for small updates.

**Solution**: Implement incremental scraping

**Features**:

- Track last scrape date for each species
- Only scrape new/updated recordings
- Merge with existing data
- Detect and remove broken URLs

---

#### 5. Backup & Version Control for Data

**Problem**: Large JSON files (birds.json) not ideal for git.

**Solutions**:

- Store data in separate Git LFS or external storage
- Implement data migration system
- Add rollback capability
- Track data provenance (when scraped, from what source)

---

### Low Priority: Nice-to-Have Features

#### 6. Web Dashboard for Data Management

**Build**: Simple web interface for:

- Viewing region data status
- Triggering scrape jobs
- Monitoring progress
- Viewing statistics
- Manual bird selection for testing

---

#### 7. Audio Quality Filtering

**Add**: Filter audio URLs by quality

- Minimum duration (e.g., 10+ seconds)
- Rating/quality scores from eBird
- Number of ratings
- Exclude low-quality recordings

---

#### 8. Multi-Language Support

**Add**: Support for localized bird names

- Fetch common names in multiple languages
- Add language selection to game
- Store translations in data files

---

#### 9. Historic Daily Challenges

**Add**: Generate past daily challenges

- Backfill daily.json for previous dates
- Useful for testing and practice mode
- Ensure no repeats in backfilled data

---

#### 10. Automated Testing Pipeline

**Add**: CI/CD tests for data quality

- Validate new data before merging
- Test hash consistency
- Verify audio URLs are accessible
- Check for duplicates

---

## Troubleshooting

### Common Issues & Solutions

#### 1. ChromeDriver Error

**Error**: `'chromedriver' executable needs to be in PATH`

**Solutions**:

```bash
# macOS
brew install chromedriver

# Linux
sudo apt-get install chromium-chromedriver

# Windows
# Download from https://chromedriver.chromium.org/
# Add to system PATH

# Or specify path directly in script
# Edit ebird-songdownload.py line 89
```

---

#### 2. eBird API Rate Limiting

**Error**: `429 Too Many Requests`

**Solutions**:

- Add delays between requests
- Implement exponential backoff
- Cache API responses
- Use API key with higher rate limit

**Example fix**:

```python
import time

# After each API call
time.sleep(1)  # Wait 1 second
```

---

#### 3. Audio URL Scraping Fails

**Error**: `⚠️ No audio/video found for species:xxx`

**Causes**:

- Species has no audio recordings on eBird
- Audio URLs are loaded via JavaScript (Selenium can't see them)
- eBird changed their HTML structure

**Solutions**:

- Skip species with no audio (will be filtered out later)
- Update XPath/CSS selectors in scraper
- Check if eBird changed page structure
- Use browser DevTools to inspect actual page

---

#### 4. Hash Mismatch Between Python and JavaScript

**Error**: Daily answers don't match between frontend and backend

**Solutions**:

```bash
# Generate test hashes
python3 verify_hash_consistency.py

# Compare with JavaScript output
# Run hash consistency tests
npm test -- hash-consistency

# Ensure salt is identical
# Python: SECRET_SALT = "birdle-salt-2025"
# JavaScript: const SECRET_SALT = "birdle-salt-2025"
```

---

#### 5. Memory Issues with Large Files

**Error**: `MemoryError` or slow processing with large taxonomy files

**Solutions**:

- Process data in chunks
- Use streaming JSON parser
- Filter early (don't load full taxonomy if not needed)
- Increase available RAM

---

#### 6. Region Not Showing in Game

**Error**: Added new region but it doesn't appear in dropdown

**Checks**:

1. Verify `public/data/regions.json` includes new region
2. Check `public/data/birds.json` has region key (e.g., "eu")
3. Ensure birds have audio URLs
4. Restart development server
5. Clear browser cache

---

#### 7. Daily Challenge Not Generating

**Error**: `generate-daily-birds.py` fails or produces no output

**Checks**:

1. Verify all input files exist:
   - `public/data/birds.json`
   - `public/data/regions.json`
   - `public/data/history.json`
2. Check for virtual region configuration errors
3. Ensure subregions file exists if using `--subregions`
4. Verify bird IDs in history.json exist in birds.json

---

### Getting Help

1. **Check logs**: All scripts print detailed progress information
2. **Validate data**: Run validation checks if available
3. **Test with subset**: Use smaller taxonomy file for testing
4. **Check eBird API status**: https://status.ebird.org/
5. **Review eBird API docs**: https://documenter.getpostman.com/view/664302/S1ENRW51?version=latest

---

## Appendix

### eBird Region Codes

Common region codes:

- `US` - United States
- `CA` - Canada
- `MX` - Mexico
- `EU` - Europe
- `GB` - United Kingdom
- `AU` - Australia
- `JP` - Japan
- `BR` - Brazil

Find more: https://ebird.org/region

### Media Tag Types

- `song` - Typical songs
- `call` - Calls and other vocalizations
- `flight-call` - Flight calls
- `non-vocal` - Non-vocal sounds (wing beats, etc.)

### File Sizes

Typical file sizes for reference:

- `ebird-taxonomy.json` - 8.8 MB (all world species)
- `us-taxonomy.json` - 585 KB (US species only)
- `us-taxonomy-urls.json` - 1.8 MB (US audio URLs)
- `birds.json` - varies by number of regions

### Performance Benchmarks

Typical execution times:

- `ebird-taxonomy.py` - 30 seconds
- `ebird-region.py` - 5 seconds
- `ebird-filter-region.py` - 10 seconds
- `ebird-generate-subregions.py` - 5 seconds
- `ebird-songdownload.py` - 2-4 hours ⚠️
- `game-data-generator.py` - 30 seconds
- `generate-daily-birds.py` - 30 seconds

### Environment Variables

Required in `scripts/.env`:

```bash
EBIRD_API_KEY=your_api_key_here
```

Optional:

```bash
CHROMEDRIVER_PATH=/path/to/chromedriver
```

---

## Summary

The Audio-Birdle scripts provide a pipeline for transforming eBird data into game content. The primary bottleneck is the manual audio URL scraping step, which requires browser automation and takes 2-4 hours per region. Once audio URLs are scraped, the rest of the pipeline is fast and automated.

**Key Takeaways**:

1. Audio scraping is the main bottleneck preventing easy region expansion
2. API-based automation works well for all steps except audio URLs
3. Daily challenge generation is fully automated and reliable
4. Hash-based selection ensures consistent answers across frontend/backend
5. Virtual regions (e.g., US-Lower48) can be created without additional scraping

**Recommended Next Steps**:

1. **Priority 1**: Research alternative audio sources or direct API access
2. **Priority 2**: Implement parallel processing for faster scraping
3. **Priority 3**: Add comprehensive data validation
4. **Priority 4**: Create automated region onboarding script
