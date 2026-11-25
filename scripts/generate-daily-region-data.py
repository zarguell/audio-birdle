import os
import json
import argparse
from pathlib import Path

import requests

import ebird_api_common


def load_regular_species(subregions_file: str, region_key: str) -> dict[str, list[str]]:
    """Load the optional sibling regular-species filter.

    A region can ship ``<region>-regular-species.json`` next to its
    ``<region>-subregions.json`` file. The daily fetch then keeps only species
    that the audit identified as regular, so a one-day vagrant cannot become
    the challenge answer.
    """
    base = Path(subregions_file).with_name(f"{region_key}-regular-species.json")
    seasonal = Path(subregions_file).with_name(
        f"{region_key}-daily-regular-species.json"
    )
    path = seasonal if seasonal.exists() else base
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Regular-species file must be an object: {path}")
    for name, ids in data.items():
        if not isinstance(name, str) or not isinstance(ids, list):
            raise ValueError(f"Invalid regular-species entry for {name!r}: {path}")
    return data


def filter_regular_species(
    unique_ids: list[str], regular_map: dict[str, list[str]], subregion_name: str
) -> list[str]:
    """Intersect an observed species list with the regular pool."""
    if not regular_map:
        return unique_ids
    allowed = set(regular_map.get(subregion_name, []))
    if not allowed:
        print(f"  Warning: no regular-species entry for {subregion_name}")
    return [species_id for species_id in unique_ids if species_id in allowed]


def load_playable_ids(output_file: str, region_key: str) -> set[str] | None:
    """Load the shipped bird IDs so filtered data never references no-audio birds."""
    birds_path = Path(output_file).with_name("birds.json")
    if not birds_path.exists():
        return None
    with birds_path.open(encoding="utf-8") as handle:
        birds = json.load(handle)
    return {bird["id"] for bird in birds.get(region_key, [])}


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

    regular_map = load_regular_species(args.subregions_file, region_key)
    playable_ids = (
        load_playable_ids(args.output_file, region_key) if regular_map else None
    )
    if regular_map:
        print(f"Using regular-species filter for {region_key}")

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

        # Extract unique species codes, then keep only the regular pool when
        # one is configured for this region.
        observed_ids = sorted({obs["speciesCode"] for obs in observations})
        unique_ids = filter_regular_species(observed_ids, regular_map, subregion_name)
        if playable_ids is not None:
            unique_ids = [
                species_id for species_id in unique_ids if species_id in playable_ids
            ]

        # Build new subregion data
        new_subregion_data = [{"id": species_id} for species_id in unique_ids]

        # Merge into existing data structure (upsert this subregion)
        existing_data[region_key][subregion_name] = new_subregion_data

        if regular_map:
            print(
                f"  {subregion_name}: {len(new_subregion_data)} regular species "
                f"(from {len(observed_ids)} observed)"
            )
        else:
            print(f"  {subregion_name}: {len(new_subregion_data)} unique species")

    # Save merged output
    with open(args.output_file, "w") as out_f:
        json.dump(existing_data, out_f, indent=2)

    print(f"Output written to {args.output_file}")


if __name__ == "__main__":
    main()
