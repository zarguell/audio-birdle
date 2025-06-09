import json
from pathlib import Path
import argparse
import sys

def filter_taxonomy(region_file: Path, taxonomy_file: Path, exclude_hybrids: bool = False):
    # Output file name (e.g., us-taxonomy.json)
    region_name = region_file.stem  # 'us' from 'us.json'
    output_path = region_file.parent / f"{region_name}-taxonomy.json"

    # Load species codes for the region
    try:
        with open(region_file, 'r', encoding='utf-8') as f:
            region_species_codes = set(json.load(f))
    except Exception as e:
        print(f"❌ Error reading region file: {e}", file=sys.stderr)
        sys.exit(1)

    # Load full taxonomy
    try:
        with open(taxonomy_file, 'r', encoding='utf-8') as f:
            full_taxonomy = json.load(f)
    except Exception as e:
        print(f"❌ Error reading taxonomy file: {e}", file=sys.stderr)
        sys.exit(1)

    # Filter for matching species codes
    filtered_taxonomy = [
        entry for entry in full_taxonomy
        if entry.get("speciesCode") in region_species_codes and
           (not exclude_hybrids or entry.get("category") != "hybrid")
    ]

    # Save filtered taxonomy
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(filtered_taxonomy, f, indent=2)
        print(f"✅ Filtered taxonomy saved to {output_path}")
    except Exception as e:
        print(f"❌ Error writing output file: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Filter eBird taxonomy by region species codes.")
    parser.add_argument("region_file", type=Path, help="Path to region JSON file (e.g. ./data/regions/us.json)")
    parser.add_argument("taxonomy_file", type=Path, help="Path to ebird-taxonomy.json file")
    parser.add_argument("--exclude-hybrids", action="store_true", help="Exclude hybrid species from output")

    args = parser.parse_args()
    filter_taxonomy(args.region_file, args.taxonomy_file, exclude_hybrids=args.exclude_hybrids)

if __name__ == "__main__":
    main()