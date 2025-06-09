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