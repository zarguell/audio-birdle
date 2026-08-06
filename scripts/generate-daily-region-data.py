import os
import json
import argparse
import requests

import ebird_api_common


def main():
    # Load API key from .env (before arg parsing so failures are early)
    api_key = ebird_api_common.load_api_key()

    # Parse CLI arguments
    parser = argparse.ArgumentParser(
        description="Fetch recent eBird observations for every subregion in a subregions file."
    )
    parser.add_argument("subregions_file", help="Path to the subregions JSON file")
    parser.add_argument("output_file", help="Path to save the output JSON file")
    args = parser.parse_args()

    # Derive the top-level region key from the filename (e.g.
    # "us-subregions.json" -> "us", "us-lower48-subregions.json" -> "us-lower48").
    # Using the full stem (not just the first dash-separated token) keeps
    # regions like "us" and "us-lower48" distinct instead of colliding.
    region_key = os.path.basename(args.subregions_file).replace("-subregions.json", "")

    # Load subregions
    with open(args.subregions_file, "r") as f:
        subregions = json.load(f)

    if not subregions:
        raise ValueError("Subregions list is empty.")

    # Load existing output file if it exists (to merge data, preserving other
    # regions/subregions already present)
    existing_data = {}
    if os.path.exists(args.output_file):
        try:
            with open(args.output_file, "r") as existing_f:
                existing_data = json.load(existing_f)
            print(f"Loaded existing data from {args.output_file}")
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load existing file, starting fresh: {e}")
            existing_data = {}

    # Process ALL subregions in the file (previously only one was picked)
    if region_key not in existing_data:
        existing_data[region_key] = {}

    for selected in subregions:
        region_code = selected["code"]
        subregion_name = selected["name"]

        print(f"Fetching observations for subregion: {subregion_name} ({region_code})")

        # Query eBird API (shared helper: timeout=30, 3 retries with backoff)
        url = f"https://api.ebird.org/v2/data/obs/{region_code}/recent"
        try:
            observations = ebird_api_common.get_json(url, api_key=api_key, timeout=30)
        except requests.RequestException as e:
            raise RuntimeError(
                f"Failed to fetch data from eBird API for {region_code}: {e}"
            ) from e

        # Extract unique species codes
        unique_ids = sorted({obs["speciesCode"] for obs in observations})

        # Build new subregion data
        new_subregion_data = [{"id": species_id} for species_id in unique_ids]

        # Merge into existing data structure (upsert this subregion)
        existing_data[region_key][subregion_name] = new_subregion_data

        print(f"  {subregion_name}: {len(new_subregion_data)} unique species")

    # Save merged output
    with open(args.output_file, "w") as out_f:
        json.dump(existing_data, out_f, indent=2)

    print(f"Output written to {args.output_file}")


if __name__ == "__main__":
    main()
