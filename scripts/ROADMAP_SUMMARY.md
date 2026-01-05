# Audio-Birdle Scripts: Key Findings & Roadmap

## Executive Summary

The Audio-Birdle scripts provide a pipeline for transforming eBird data into game content. The current workflow is **70% automated** but has a **critical manual bottleneck** in audio URL scraping that prevents easy scaling to new regions.

---

## Current State Assessment

### ✅ What Works Well

1. **API-Based Automation** (Fast & Reliable)
   - eBird taxonomy fetching: 30 seconds
   - Region species lists: 5 seconds
   - Subregion generation: 5 seconds
   - Data filtering/processing: 10-30 seconds
   - Daily challenge generation: 30 seconds

2. **Deterministic Daily Selection**
   - Hash-based bird selection
   - Consistent between Python backend and JavaScript frontend
   - Subregion-aware selection
   - Virtual region support (e.g., US-Lower48)

3. **Automated Daily Updates**
   - GitHub Actions runs at 4 AM UTC
   - Generates daily challenges for all regions
   - Tracks history to prevent repeats

4. **Multi-Region Architecture**
   - Clean separation of regions
   - Virtual regions inherit from parent regions
   - Subregion filtering for variety

### ⚠️ Critical Bottleneck

**Audio URL Scraping**
- **Time**: 2-4 hours per region
- **Method**: Browser automation via Selenium
- **Reliability**: Fragile (HTML changes break it)
- **Scalability**: Poor (manual process required)
- **Rate Limiting**: May trigger eBird blocking

**Impact**:
- Adding one new region = 2-4 hours of manual scraping
- Must repeat for each audio type (song, call)
- Browser window must remain visible
- Requires monitoring and potential restarts
- **This is why you're stuck on just US region**

---

## Data Flow Analysis

### Phase 1: Base Data (One-Time Setup)
```
ebird-taxonomy.py → ebird-taxonomy.json (8.8MB)
```
**Time**: 30 seconds
**Frequency**: Quarterly updates
**Bottleneck**: No

### Phase 2: Region Setup (Per Region)
```
ebird-region.py → us.json (5s)
ebird-filter-region.py → us-taxonomy.json (10s)
ebird-generate-subregions.py → us-subregions.json (5s)
```
**Total Time**: 20 seconds
**Frequency**: Once per region
**Bottleneck**: No

### Phase 3: Audio Scraping (Per Region) ⚠️
```
ebird-songdownload.py → us-taxonomy-urls.json
```
**Time**: 2-4 hours
**Frequency**: Once per region per audio type
**Bottleneck**: YES - This is the problem

### Phase 4: Game Data Generation (Per Region)
```
game-data-generator.py → birds.json (30s)
generate-daily-region-data.py → daily-subregion-birds.json (10s)
```
**Total Time**: 40 seconds
**Frequency**: Once per region
**Bottleneck**: No

### Phase 5: Daily Operations (Automated)
```
generate-daily-birds.py → daily.json, history.json (30s)
```
**Time**: 30 seconds
**Frequency**: Daily (GitHub Actions)
**Bottleneck**: No

---

## Roadmap for Improvement

### 🔴 High Priority: Remove Manual Bottleneck

#### 1. Replace Selenium with API-Based Approach

**Problem**: eBird doesn't document a public API for audio URLs

**Research Areas**:
- Reverse-engineer eBird's internal API calls
- Check if audio URLs follow predictable patterns
- Investigate XHR calls made by eBird website (browser DevTools Network tab)
- Look for undocumented endpoints

**Potential Solutions**:

**Option A: Direct API Access**
- Use browser DevTools to capture XHR requests when browsing eBird audio catalog
- Identify internal API endpoints
- Replicate requests with proper authentication
- **Effort**: Medium (2-3 days research + implementation)
- **Impact**: Eliminates scraping entirely, reduces time from 4 hours to 5 minutes
- **Risk**: API may change, may require authentication tokens

**Option B: Predictable URL Patterns**
- Analyze existing audio URLs for patterns
- Test if URLs can be constructed without scraping
- Example: `https://cdn.download.earth.ebird.org/{asset_id}.mp3`
- **Effort**: Low (1 day research + testing)
- **Impact**: If successful, eliminates scraping
- **Risk**: May not be possible if URLs are random/obfuscated

**Option C: Alternative Audio Sources**
- **Xeno-Canto.org**: Has documented API, large bird sound database
- **Macaulay Library** (Cornell): High-quality recordings, API access available
- **Wikimedia Commons**: Open license audio files
- **Effort**: High (1-2 weeks to integrate new source)
- **Impact**: Better audio quality, documented APIs, no scraping needed
- **Risk**: Different coverage than eBird, may not match eBird species lists

---

#### 2. Optimize Current Scraping (Fallback)

If API-based approach isn't feasible, improve existing scraping:

**Parallel Processing**
```python
# Use asyncio for concurrent page loads
# Or multiprocessing for multiple browser instances
# Potential speedup: 4-6x faster (from 4 hours to 30-45 minutes)
```

**Smart Retry Logic**
```python
# Exponential backoff on errors
# Checkpointing to resume after failures
# Better error handling and recovery
```

**Progress Tracking**
```python
# Save progress after each species
# Resume from last checkpoint if script crashes
# Display ETA and progress percentage
```

**Effort**: Low (1-2 days implementation)
**Impact**: Reduces scraping time from 4 hours to 30-45 minutes
**Risk**: Still fragile, still rate-limited

---

#### 3. Community-Sourced Database

**Concept**: Build a shared database of scraped audio URLs

**Features**:
- Users can contribute their region's scraped data
- Import/export functionality
- Merge data from multiple contributors
- Track data provenance (when scraped, from what source)
- Web interface for browsing and contributing

**Implementation**:
```json
{
  "region": "eu",
  "scrapedDate": "2025-01-05",
  "scrapedBy": "user@email.com",
  "audioUrls": [...],
  "verified": true
}
```

**Effort**: Medium (1-2 weeks)
**Impact**: Scales to unlimited regions through community effort
**Risk**: Data quality concerns, need verification system

---

### 🟡 Medium Priority: Enhanced Automation

#### 4. End-to-End Region Onboarding Script

**Goal**: Single command to add new region

```bash
python3 add-region.py --region EU --audio-types song,call
```

**Features**:
- Automated error checking
- Progress tracking and logging
- Dry-run mode for testing
- Rollback capability
- Validation at each step
- Summary report

**Steps Automated**:
1. Fetch region species list
2. Filter taxonomy
3. Generate subregions
4. Scrape audio URLs
5. Generate game data
6. Update configuration files
7. Run validation tests
8. Generate summary report

**Effort**: Medium (3-5 days)
**Impact**: Reduces region onboarding from manual multi-day process to single command

---

#### 5. Data Validation & Quality Checks

**Create**: `validate-data.py`

**Checks**:
- All birds have required fields (id, name, audioUrl)
- Audio URLs are accessible (HTTP HEAD requests)
- No duplicate species codes within region
- Hash consistency between Python and JavaScript
- Region coverage (e.g., "Europe should have 500+ species")
- Audio file format validation
- Duration checks (exclude very short recordings)

**Usage**:
```bash
python3 validate-data.py --region EU
```

**Output**:
```
✓ All 523 birds have required fields
✓ 5,230 audio URLs validated
✗ 12 URLs are inaccessible (404 errors)
✓ Hash consistency verified
⚠ Region has fewer birds than expected (523 vs expected 600+)
```

**Effort**: Low (1-2 days)
**Impact**: Catches data quality issues early

---

#### 6. Incremental Updates

**Problem**: Currently must re-scrape all audio URLs even for small updates

**Solution**: Track and update only new/changed recordings

**Implementation**:
```python
# Track last scrape date for each species
{
  "speciesCode": "amerob",
  "lastScraped": "2025-01-01",
  "urlCount": 10,
  "urls": [...]
}

# Only scrape new/updated recordings
# Merge with existing data
# Detect and remove broken URLs
```

**Benefits**:
- Faster updates (minutes vs hours)
- Less load on eBird servers
- Easier to maintain

**Effort**: Medium (2-3 days)
**Impact**: Significantly faster maintenance updates

---

#### 7. Backup & Version Control for Data

**Problem**: Large JSON files (birds.json) not ideal for git

**Solutions**:
- Store data in Git LFS or external storage (S3, Cloudflare R2)
- Implement data migration system (versioned schemas)
- Add rollback capability
- Track data provenance (when scraped, from what source)

**Effort**: Medium (2-3 days)
**Impact**: Better data management and recovery

---

### 🟢 Low Priority: Nice-to-Have Features

#### 8. Web Dashboard for Data Management
- View region data status
- Trigger scrape jobs
- Monitor progress
- View statistics
- Manual bird selection for testing

**Effort**: High (1-2 weeks)
**Impact**: Better user experience for maintainers

---

#### 9. Audio Quality Filtering
- Minimum duration (e.g., 10+ seconds)
- Rating/quality scores from eBird
- Number of ratings
- Exclude low-quality recordings

**Effort**: Low (1 day)
**Impact**: Better game experience with higher quality audio

---

#### 10. Multi-Language Support
- Fetch common names in multiple languages
- Add language selection to game
- Store translations in data files

**Effort**: Medium (3-5 days)
**Impact**: International accessibility

---

#### 11. Historic Daily Challenges
- Generate past daily challenges for testing
- Backfill daily.json for previous dates
- Useful for practice mode

**Effort**: Low (1 day)
**Impact**: Better testing and practice capabilities

---

#### 12. Automated Testing Pipeline
- Validate new data before merging to main
- Test hash consistency
- Verify audio URLs are accessible
- Check for duplicates
- Run in GitHub Actions

**Effort**: Low (1-2 days)
**Impact**: Prevents bad data from being deployed

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 weeks)
1. ✅ **Data validation script** (2 days)
2. ✅ **Parallel processing for scraping** (2 days)
3. ✅ **Incremental updates** (3 days)
4. ✅ **Audio quality filtering** (1 day)

**Impact**: Improves current workflow, faster scraping

### Phase 2: Research Alternative Approaches (1-2 weeks)
1. 🔍 **Research eBird internal API** (3-5 days)
2. 🔍 **Test Xeno-Canto API** (2-3 days)
3. 🔍 **Analyze audio URL patterns** (1 day)

**Impact**: Determines if scraping can be eliminated

### Phase 3: Community & Automation (2-3 weeks)
1. 🌐 **Community-sourced database** (1-2 weeks)
2. 🚀 **Automated region onboarding** (3-5 days)
3. 🔄 **Backup & version control** (2-3 days)

**Impact**: Scales to unlimited regions

### Phase 4: Polish & Extras (1-2 weeks)
1. 🎨 **Web dashboard** (optional, 1-2 weeks)
2. 🌍 **Multi-language support** (3-5 days)
3. 📜 **Historic challenges** (1 day)
4. ✅ **Automated testing pipeline** (1-2 days)

**Impact**: Better user experience and maintainability

---

## Success Metrics

### Current State
- Time to add new region: **4-6 hours** (mostly manual)
- Regions supported: **2** (US, US-Lower48)
- Automation level: **70%**
- Maintenance effort: **High** (manual scraping)

### Target State (After Phase 1-2)
- Time to add new region: **30-45 minutes** (mostly automated)
- Regions supported: **10+** (Europe, Canada, etc.)
- Automation level: **95%**
- Maintenance effort: **Low** (automated updates)

### Stretch Goal (After Phase 3)
- Time to add new region: **5-10 minutes** (fully automated)
- Regions supported: **50+** (global coverage)
- Automation level: **99%**
- Maintenance effort: **Minimal** (community-supported)

---

## Conclusion

The Audio-Birdle scripts have a **solid foundation** with excellent automation for most steps. The **primary blocker** is audio URL scraping, which is a **manual, fragile, time-consuming process**.

**Recommended immediate actions**:
1. **Research alternative audio sources** (Xeno-Canto API, eBird internal API)
2. **Implement parallel processing** to speed up current scraping
3. **Add data validation** to catch quality issues
4. **Build automated onboarding script** to streamline the process

**Long-term vision**:
- Eliminate scraping entirely through API access
- Build community-sourced database for global coverage
- Achieve near-full automation for scaling to 50+ regions

---

## Quick Reference

**Documentation Files**:
- [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) - Complete technical documentation
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - One-page cheat sheet
- [README.md](./README.md) - Quick start guide

**Key Scripts**:
- [ebird-songdownload.py](./ebird-songdownload.py) ⚠️ - Bottleneck (2-4 hours)
- [generate-daily-birds.py](./generate-daily-birds.py) - Daily challenges
- [game-data-generator.py](./game-data-generator.py) - Game data

**Current Status**:
- Supported: US, US-Lower48
- Bottleneck: Audio URL scraping
- Daily updates: Automated via GitHub Actions
