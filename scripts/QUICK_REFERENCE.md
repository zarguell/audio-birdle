# Audio-Birdle Scripts: Quick Reference

## One-Page Summary

### Workflow Overview

```
┌─────────────────┐
│  PHASE 1: BASE  │  (Run once, reuse for all regions)
│  Global Data    │
└────────┬────────┘
         │
         ▼
   ebird-taxonomy.py → ebird-taxonomy.json (8.8MB, all species)
         │
         ├─────────────────────────────────────────────────────────┐
         │                                                         │
         ▼                                                         ▼
┌─────────────────┐                                     ┌─────────────────┐
│  PHASE 2: SETUP │                                     │  FOR NEW REGION │
│  Per Region     │                                     │  Repeat Steps   │
└────────┬────────┘                                     │  2-8            │
         │                                               └─────────────────┘
         ▼
  1. ebird-region.py → us.json (species codes)
         │
         ▼
  2. ebird-filter-region.py → us-taxonomy.json (filtered taxonomy)
         │
         ▼
  3. ebird-generate-subregions.py → us-subregions.json (states)
         │
         ▼
┌─────────────────┐
│  PHASE 3: AUDIO │  ⚠️ MANUAL BOTTLENECK - 2-4 hours
│  Scrape URLs    │
└────────┬────────┘
         │
         ▼
  xc-audio-fetch.py → us-taxonomy-urls.json (Xeno-canto API v3)
         │
         ▼
┌─────────────────┐
│  PHASE 4: DATA  │
│  Generation     │
└────────┬────────┘
         │
         ▼
  game-data-generator.py → birds.json (merge taxonomy + URLs)
         │
         ▼
  generate-daily-region-data.py → daily-subregion-birds.json
         │
         ▼
┌─────────────────┐
│  PHASE 5: DAILY │  (Automated: GitHub Actions, 4 AM UTC)
│  Challenges     │
└────────┬────────┘
         │
         ▼
  generate-daily-birds.py → daily.json, history.json
```

---

## Script Cheat Sheet

### API-Based Scripts (Fast, Automated)

| Script                          | Purpose                 | Input              | Output                     | Time |
| ------------------------------- | ----------------------- | ------------------ | -------------------------- | ---- |
| `ebird-taxonomy.py`             | Get global taxonomy     | -                  | ebird-taxonomy.json        | 30s  |
| `ebird-region.py`               | Get region species list | region code        | us.json                    | 5s   |
| `ebird-generate-subregions.py`  | Get subregions          | region code        | us-subregions.json         | 5s   |
| `ebird-filter-region.py`        | Filter taxonomy         | us.json + taxonomy | us-taxonomy.json           | 10s  |
| `game-data-generator.py`        | Merge game data         | taxonomy + URLs    | birds.json                 | 30s  |
| `generate-daily-region-data.py` | Get subregion birds     | subregions         | daily-subregion-birds.json | 10s  |
| `generate-daily-birds.py`       | Daily challenges        | birds + history    | daily.json                 | 30s  |

### Manual Script (Slow, Bottleneck)

| Script                     | Purpose           | Input    | Output             | Time          |
| -------------------------- | ----------------- | -------- | ------------------ | ------------- |
| `xc-audio-fetch.py` | Fetch audio URLs + metadata (XC API v3) | taxonomy | taxonomy-urls.json | ~15 min |

---

## Adding a New Region: Step-by-Step

```bash
# 1. Get region species (5 seconds)
python3 ebird-region.py --region EU --output data/regions/eu.json

# 2. Filter taxonomy (10 seconds)
python3 ebird-filter-region.py data/regions/eu.json data/ebird-taxonomy.json --exclude-hybrids

# 3. Get subregions (5 seconds)
python3 ebird-generate-subregions.py --region EU --output data/regions/eu-subregions.json

# 4. ⚠️ SCRAPE AUDIO URLS - 2-4 hours, opens Chrome browser
python3 xc-audio-fetch.py data/regions/eu-taxonomy.json --country "United Kingdom" --tag song --max-urls 10

# 5. Generate game data (30 seconds)
python3 game-data-generator.py --region EU \
  --taxonomy data/regions/eu-taxonomy.json \
  --urls data/regions/eu-taxonomy-urls.json \
  --output ../public/data/birds.json

# 6. Update regions.json manually
# Add: {"id": "eu", "name": "Europe", "country": "EU"}

# 7. Generate subregion bird data (10 seconds)
python3 generate-daily-region-data.py \
  data/regions/eu-subregions.json \
  ../public/data/daily-subregion-birds.json

# 8. Test and deploy
npm run dev  # Test in browser
git add public/data/
git commit -m "feat: Add Europe region"
git push
```

---

## Common Commands

### Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install pandas requests beautifulsoup4 selenium python-dotenv
echo "EBIRD_API_KEY=your_key" > .env
```

### Daily Operations (Automated)

```bash
# Generate daily challenges
python3 generate-daily-birds.py --days 7 \
  --subregions ../public/data/daily-subregion-birds.json

# Verify hash consistency
python3 verify_hash_consistency.py
```

### Testing

```bash
# Validate data (if script exists)
python3 validate-data.py --region US

# Test with small dataset
python3 xc-audio-fetch.py data/regions/us-taxonomy-demo.json --max-urls 5
```

---

## Troubleshooting Quick Fixes

### ChromeDriver Issues

```bash
# macOS
brew install chromedriver

# Linux
sudo apt-get install chromium-chromedriver

# Or specify path in ebird-songdownload.py line 89
```

### API Rate Limiting

Add delays in scripts:

```python
import time
time.sleep(1)  # Between requests
```

### Hash Mismatch

```bash
python3 verify_hash_consistency.py
npm test -- hash-consistency
# Check salt is "birdle-salt-2025" in both
```

### Region Not Showing

1. Check `public/data/regions.json` has region
2. Check `public/data/birds.json` has region key
3. Restart dev server
4. Clear browser cache

---

## Key Files

| File                                 | Purpose           | Size   |
| ------------------------------------ | ----------------- | ------ |
| `data/ebird-taxonomy.json`           | All world species | 8.8 MB |
| `data/regions/us.json`               | US species codes  | 16 KB  |
| `data/regions/us-taxonomy.json`      | US taxonomy       | 585 KB |
| `data/regions/us-taxonomy-urls.json` | US audio URLs     | 1.8 MB |
| `public/data/birds.json`             | Game data         | varies |
| `public/data/daily.json`             | Daily answers     | small  |
| `public/data/history.json`           | Selection history | grows  |

---

## Environment Variables

**Required in `.env`**:

```bash
EBIRD_API_KEY=your_api_key_here
```

**Get API key**: https://ebird.org/api/keygen

---

## Bird Data Schema

Each bird in `birds.json` has the following structure:

```json
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
      "url": "https://example.com/image.jpg",
      "attribution": {
        "photographer": "Jane Smith",
        "source": "Macaulay Library",
        "license": "CC BY-NC 4.0"
      }
    }
  ],
  "facts": "Short educational fact about the bird...",
  "learnMoreUrl": "https://external-source.org/species/..."
}
```

**Field Notes**:

- `audioUrl`: Array of objects with URL and attribution (required, can be empty placeholder)
- `images`: Array of image objects with URL and attribution (optional)
- `facts`: Short educational text about the bird (optional)
- `learnMoreUrl`: External link for more information (optional)
- `attribution`: Supports multiple audio/images with individual credits

---

## Performance Tips

1. **Audio Scraping Bottleneck**: Biggest limitation - 2-4 hours per region
2. **Parallel Processing**: Can speed up API calls (not scraping)
3. **Caching**: Reuse taxonomy.json across regions
4. **Incremental Updates**: Only scrape new/changed URLs

---

## Roadmap Highlights

### High Priority

- ⚠️ **Replace Selenium scraping** with API-based approach
- 🔧 **Parallel processing** for faster scraping
- 🌐 **Community-sourced audio database**

### Medium Priority

- 🚀 **Automated region onboarding** script
- ✔️ **Data validation** checks
- 🔄 **Incremental updates** (don't re-scrape everything)

### Low Priority

- 📊 **Web dashboard** for data management
- 🔊 **Audio quality filtering**
- 🌍 **Multi-language support**

---

## Full Documentation

See [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) for:

- Detailed architecture explanation
- Complete script reference
- Troubleshooting guide
- Data flow diagrams
- Improvement roadmap

---

## Quick Links

- **eBird API Docs**: https://documenter.getpostman.com/view/664302/S1ENRW51
- **Get API Key**: https://ebird.org/api/keygen
- **Region Codes**: https://ebird.org/region
- **ChromeDriver**: https://chromedriver.chromium.org/

---

## Current Status

✅ **Supported Regions**:

- US (United States)
- US-Lower48 (virtual region)

⚠️ **Scaling Limitation**:

- Audio scraping requires manual browser automation
- 2-4 hours per region per audio type
- Blocks easy expansion to new regions

🔄 **Automated**:

- Daily challenge generation (GitHub Actions, 4 AM UTC)
- All data fetching via eBird API
- Game data generation

---

## Summary

**The Good**:

- ✅ Clean API-based automation for most steps
- ✅ Fast data processing (seconds to minutes)
- ✅ Reliable daily challenge generation
- ✅ Hash-based consistency between frontend/backend

**The Challenge**:

- ⚠️ Audio URL scraping is manual bottleneck
- ⚠️ 2-4 hours of browser automation per region
- ⚠️ Blocks easy expansion to new regions

**The Solution**:

- 🔜 Research alternative audio sources
- 🔜 Implement parallel processing
- 🔜 Build community-sourced database
- 🔜 Automate end-to-end region onboarding
