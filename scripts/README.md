# Get eBird Taxonomy

```bash
(venv) user@localhost scripts % python3 ebird-taxonomy.py --fmt json --output '.\data\ebird-taxonomy.json'
Data saved to .\data\ebird-taxonomy.json
(venv) user@localhost scripts % python3 ebird-taxonomy.py --fmt csv --output '.\data\ebird-taxonomy.csv'
Data saved to .\data\ebird-taxonomy.csv
```

# Get Regions

```bash
python3 eBird-Region.py --region US --output us.json
```

# Filter Taxonomy for a Region

```bash
python ebird-filter-region.py ./data/regions/us.json ./data/ebird-taxonomy.json --exclude-hybrids
✅ Filtered taxonomy saved to data/regions/us-taxonomy.json
```

# Getting calls and songs

Urls:
```
https://media.ebird.org/catalog?tag=song&regionCode=US&taxonCode=amerob
https://media.ebird.org/catalog?tag=call&regionCode=US&taxonCode=amerob
```


Perfect! I’ve updated your script with all the requested features:

## New CLI Arguments:

- `--max-urls` (default: 10): Limits the number of audio URLs per species
- `--region` (default: “US”): Allows specifying different region codes
- `--tag` (default: “song”): Allows specifying different media tags

## Output File Changes:

- The output file is now saved as JSON in the same directory as the input file
- The filename follows the pattern `{original-filename}-urls.json`
- For example: `./data/regions/us-taxonomy-demo.json` → `./data/regions/us-taxonomy-demo-urls.json`

## Usage Examples:

```bash
# Basic usage (10 URLs per species, US region, song tag)
python3 ebird-songdownload.py ./data/regions/us-taxonomy-demo.json

# Custom max URLs
python3 ebird-songdownload.py ./data/regions/us-taxonomy-demo.json --max-urls 5

# Different region and tag
python3 ebird-songdownload.py ./data/regions/us-taxonomy-demo.json --region CA --tag call

# All options combined
python3 ebird-songdownload.py ./data/regions/us-taxonomy-demo.json --max-urls 20 --region MX --tag song
```

The script now limits the number of URLs collected per species both during the page loading process (stops clicking “more results” once limit is reached) and when parsing the results (slices the list to the maximum). The output is also saved as a more structured JSON file rather than CSV.​​​​​​​​​​​​​​​​
# Generating and Checking Bird Hash for Answer of the Day

```
// Copy your hash function and dependencies directly
// Fixed hash function that prevents negative values
const hashString = (str) => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to unsigned 32-bit integer to prevent negative values
  return hash >>> 0;
};

const SECRET_SALT = "birdle-salt-2025";

const hashBirdId = (birdId) => {
  const combined = `${birdId}-${SECRET_SALT}`;
  const fullHash = hashString(combined).toString(16);
  return fullHash.substring(0, 8);
};

// Test the fixed version
console.log('Fixed hash for "bkfg":', hashBirdId("bkfg"));

// Compare with original (problematic) version
const hashStringOriginal = (str) => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash; // This can be negative!
};

const hashBirdIdOriginal = (birdId) => {
  const combined = `${birdId}-${SECRET_SALT}`;
  const fullHash = hashStringOriginal(combined).toString(16);
  return fullHash.substring(0, 8);
};

console.log('Original (broken) hash for "bkfg":', hashBirdIdOriginal("bkfg"));
console.log('Difference: Original can produce negative hashes with minus signs');
```


# Adding more birds to birds.json game data

```
python ./scripts/game-data-generator.py --region US --taxonomy ./scripts/data/regions/us-taxonomy.json --urls ./scripts/data/regions/us-taxonomy-urls.json --output ./public/data/birds.json
Loading taxonomy data from './scripts/data/regions/us-taxonomy.json'...
Loading URLs data from './scripts/data/regions/us-taxonomy-urls.json'...
Checking for existing output file './public/data/birds.json'...
Processing URL data...
Processing taxonomy data and matching with audio URLs...
Found 704 birds with audio URLs for region 'US'
Successfully saved data to './public/data/birds.json'
Processing complete!
```

# Generating subregions (states)

```
python ./scripts/ebird-generate-subregions.py --region US --output ./scripts/data/regions/us-subregions.json   
Data saved to ./scripts/data/regions/us-subregions.json
```


# Generating region / state specific corpus for daily challenges

```
python ./scripts/generate-daily-region-data.py ./scripts/data/regions/us-subregions.json ./public/data/daily-subreg
ion-birds.json
Selected subregion: Minnesota (US-MN)
Output written to ./public/data/daily-subregion-birds.json
```