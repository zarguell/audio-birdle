#!/usr/bin/env python3
"""
Daily Bird Generator Script

Generates daily bird answers for each region, ensuring no repeats within X days.
Optionally filters by subregion (e.g., US states) if subregions file is provided.

Determinism invariant:
    For a fixed input set (birds.json, regions.json, subregions data, --date),
    running this script MUST produce byte-identical daily.json and history.json
    outputs on every run, regardless of PYTHONHASHSEED or any other
    process-local randomness. This is guaranteed by:

      * seeding the RNG with a SHA-256 digest of (date, region) instead of the
        per-process randomized built-in hash()
      * never re-seeding from system time afterwards, so the subsequent
        random.choice() for bird selection continues from the same
        deterministic stream
      * upserting (never reordering) history and daily entries, and emitting
        daily.json in canonical (date, region) order

Usage: python generate-daily-birds.py [--days X] [--date YYYY-MM-DD] [--subregions subregions.json]
"""

import json
import argparse
import hashlib
import random
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Salt for hashing (must match JavaScript implementation)
SECRET_SALT = "birdle-salt-2025"


def hash_bird_id(bird_id):
    """
    Hash a bird ID with the secret salt using the DJB2 hash algorithm.

    This implements the canonical DJB2 hash algorithm and MUST match the
    JavaScript implementation in HashUtils.jsx exactly. Both implementations
    must produce identical 8-character lowercase hex strings for daily bird
    selection to work correctly.

    Algorithm: hash = ((hash << 5) - hash) + char_code
    Output: 32-bit unsigned integer formatted as 8-character lowercase hex

    Args:
        bird_id: The bird's unique identifier (e.g., "amerob")

    Returns:
        8-character lowercase hex string (e.g., "104c723e")

    Note:
        The salt (SECRET_SALT) is appended to the bird_id before hashing
        to prevent reverse engineering and ensure consistent hashing across
        the data pipeline (Python scripts → daily.json → JavaScript frontend).
    """
    combined = f"{bird_id}-{SECRET_SALT}"
    hash_value = 0

    for char in combined:
        char_code = ord(char)
        hash_value = ((hash_value << 5) - hash_value) + char_code
        # Ensure 32-bit unsigned integer (matches JavaScript >>> 0)
        hash_value = hash_value & 0xFFFFFFFF
        # Manual signed/unsigned adjustment for Python compatibility
        if hash_value >= 0x80000000:
            hash_value -= 0x100000000

    # Convert to 8-character lowercase hex with zero-padding
    # format(..., '08x') produces zero-padded hex, [:8] ensures exactly 8 chars
    hex_hash = format(hash_value & 0xFFFFFFFF, "08x")
    return hex_hash[:8]


def load_json_file(file_path):
    """Load JSON file with error handling"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {file_path} not found, creating empty structure")
        return {} if "history" in str(file_path) else []
    except json.JSONDecodeError as e:
        print(f"Error parsing {file_path}: {e}")
        sys.exit(1)


def save_json_file(file_path, data):
    """Save JSON file with proper formatting"""
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_recent_answers(history, region, days, current_date):
    """Get bird IDs that were answers in the last X days for a region"""
    recent_answers = set()
    cutoff_date = current_date - timedelta(days=days)

    region_history = history.get(region, [])
    for entry in region_history:
        entry_date = datetime.strptime(entry["date"], "%Y-%m-%d").date()
        if entry_date > cutoff_date:
            recent_answers.add(entry["id"])

    return recent_answers


def get_subregion_for_date(subregions_data, region_id, target_date):
    """
    Select a subregion for the given date and region.

    Deterministic: seeds the RNG from a SHA-256 digest of (date, region) so
    the chosen subregion is stable across runs and processes — unlike Python's
    built-in hash(), which is randomized per process via PYTHONHASHSEED.
    """
    region_subregions = subregions_data.get(region_id, {})
    if not region_subregions:
        return None, []

    # Get list of available subregions
    subregion_names = list(region_subregions.keys())
    if not subregion_names:
        return None, []

    # Seed from a stable SHA-256 digest, NOT hash() (per-process randomized).
    # Do NOT re-seed from system time afterwards: select_bird_for_region's
    # random.choice() must continue from this same stream so the whole run is
    # deterministic for a given (region, date).
    date_seed = target_date.strftime("%Y-%m-%d") + region_id
    seed_int = int(hashlib.sha256(date_seed.encode()).hexdigest()[:16], 16)
    random.seed(seed_int)
    selected_subregion = random.choice(subregion_names)

    # Get bird IDs for this subregion
    subregion_bird_ids = set()
    for bird_entry in region_subregions[selected_subregion]:
        subregion_bird_ids.add(bird_entry["id"])

    return selected_subregion, subregion_bird_ids


def filter_birds_by_subregion(birds, subregion_bird_ids):
    """Filter birds list to only include birds from the subregion"""
    if not subregion_bird_ids:
        return birds

    filtered_birds = [bird for bird in birds if bird["id"] in subregion_bird_ids]
    return filtered_birds


def verify_bird_exists_in_birds_json(
    selected_bird, birds_data, region_id, virtual_regions
):
    """
    Verify that the selected bird ID exists in birds.json before hashing.
    This prevents data consistency issues where a bird exists in subregion data
    but not in the final birds.json file.

    Returns: True if bird exists, False otherwise
    """
    bird_id = selected_bird["id"]
    bird_name = selected_bird["name"] if "name" in selected_bird else "Unknown"

    check_region_id = region_id
    if virtual_regions and region_id in virtual_regions:
        check_region_id = virtual_regions[region_id]["parent"]

    region_birds = birds_data.get(check_region_id, [])
    if not region_birds:
        print(f"Error: No birds found in birds.json for region {check_region_id}")
        return False

    bird_exists = any(bird["id"] == bird_id for bird in region_birds)

    if not bird_exists:
        print(
            f"ERROR: Selected bird '{bird_id}' ({bird_name}) "
            f"does not exist in birds.json for region '{check_region_id}'. "
            f"This indicates a data consistency issue between subregion data and birds.json."
        )
        return False

    return True


def select_bird_for_region(
    birds,
    recent_answers,
    subregion_bird_ids=None,
    birds_data=None,
    region_id=None,
    virtual_regions=None,
):
    """
    Select a random bird that hasn't been used recently, optionally filtered by subregion.
    Now includes verification that the selected bird exists in birds.json.
    """
    if subregion_bird_ids:
        filtered = filter_birds_by_subregion(birds, subregion_bird_ids)
        if not filtered:
            # The printed message promises a fallback to the full region pool,
            # so honor it: keep the unfiltered birds. None is returned only
            # when no birds exist at all (checked below).
            print("Warning: No birds available in subregion. Using all region birds.")
        else:
            birds = filtered

    available_birds = [bird for bird in birds if bird["id"] not in recent_answers]

    if not available_birds:
        print(
            "Warning: No birds available that haven't been used recently. Using all birds."
        )
        available_birds = birds

    if not available_birds:
        return None

    selected_bird = random.choice(available_birds)

    if birds_data and region_id:
        if not verify_bird_exists_in_birds_json(
            selected_bird, birds_data, region_id, virtual_regions
        ):
            print("Retrying with a different bird...")
            available_birds = [
                b for b in available_birds if b["id"] != selected_bird["id"]
            ]
            if available_birds:
                return random.choice(available_birds)
            return None

    return selected_bird


def update_history(history, daily_data, current_date, birds_data, virtual_regions=None):
    """
    Update history with yesterday's answers from daily.json.

    daily.json entries carry an additive "id" field (the bird id), which lets
    us recover the bird's name from birds_data (the answerHash alone cannot be
    reversed). Entries are upserted by (region, date): an existing entry for
    the same region+date is replaced in place, otherwise it is appended.
    """
    virtual_regions = virtual_regions or {}
    yesterday = current_date - timedelta(days=1)
    yesterday_str = yesterday.strftime("%Y-%m-%d")

    for entry in daily_data:
        if entry.get("date") != yesterday_str:
            continue

        region = entry["region"]
        bird_id = entry.get("id")
        if not bird_id:
            print(
                f"Note: daily.json entry for {region} on {yesterday_str} "
                f"has no 'id'; cannot update history"
            )
            continue

        # Resolve the bird's display name from birds_data, following virtual
        # regions to their parent region's bird list.
        lookup_region = region
        if region in virtual_regions:
            lookup_region = virtual_regions[region]["parent"]
        name = None
        for bird in birds_data.get(lookup_region, []):
            if bird["id"] == bird_id:
                name = bird.get("name")
                break
        if name is None:
            print(
                f"Warning: could not find bird '{bird_id}' in birds_data "
                f"for region {region}; using id as name"
            )
            name = bird_id

        history_entry = {"date": yesterday_str, "id": bird_id, "name": name}
        if "subregion" in entry:
            history_entry["subregion"] = entry["subregion"]

        if region not in history:
            history[region] = []

        # Upsert by (region, date): replace an existing entry, else append.
        for idx, existing in enumerate(history[region]):
            if existing.get("date") == yesterday_str:
                history[region][idx] = history_entry
                break
        else:
            history[region].append(history_entry)

    return history


def build_region_birds(
    region_id, birds_data, virtual_regions, subregions_data, target_date
):
    """
    Determine the bird pool and optional subregion filter for one region.

    Handles virtual regions: falls back to the parent region's birds and
    removes excluded subregions from the selection pool.

    Returns:
        (region_birds, selected_subregion, subregion_bird_ids)
    """
    region_birds = birds_data.get(region_id, [])
    if not region_birds and region_id in virtual_regions:
        # Virtual region - use parent region's birds
        parent_id = virtual_regions[region_id]["parent"]
        region_birds = birds_data.get(parent_id, [])
        print(
            f"Using parent region '{parent_id}' birds for virtual region '{region_id}'"
        )

    selected_subregion = None
    subregion_bird_ids = set()

    if subregions_data:
        # For virtual regions, filter out excluded subregions from available list
        modified_subregions_data = subregions_data
        if region_id in virtual_regions:
            # Get subregions from parent region, not from virtual region itself
            parent_id = virtual_regions[region_id]["parent"]
            region_subregions = subregions_data.get(parent_id, {}).copy()
            excluded = virtual_regions[region_id]["excludedSubregions"]

            # Remove excluded subregions from the selection pool
            for excluded_sub in excluded:
                if excluded_sub in region_subregions:
                    print(
                        f"Excluding subregion '{excluded_sub}' for virtual region '{region_id}'"
                    )
                    del region_subregions[excluded_sub]

            if region_subregions:
                modified_subregions_data = {region_id: region_subregions}
            else:
                print(f"No valid subregions remaining after exclusions for {region_id}")
                modified_subregions_data = {}

        selected_subregion, subregion_bird_ids = get_subregion_for_date(
            modified_subregions_data, region_id, target_date
        )

        if selected_subregion:
            print(f"Selected subregion: {selected_subregion}")
            print(f"Subregion has {len(subregion_bird_ids)} bird species")
        else:
            print("No subregion data available for this region")

    return region_birds, selected_subregion, subregion_bird_ids


def main():
    parser = argparse.ArgumentParser(description="Generate daily bird answers")
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of days to avoid repeating birds (default: 7)",
    )
    parser.add_argument(
        "--date", type=str, help="Date to generate for (YYYY-MM-DD, default: today)"
    )
    parser.add_argument(
        "--subregions",
        type=str,
        help="Path to subregions JSON file for filtering birds by state/province",
    )

    args = parser.parse_args()

    # Set up paths
    base_path = Path("./public/data")
    regions_path = base_path / "regions.json"
    birds_path = base_path / "birds.json"
    history_path = base_path / "history.json"
    daily_path = base_path / "daily.json"

    # Parse target date
    if args.date:
        try:
            target_date = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            print("Error: Date must be in YYYY-MM-DD format")
            sys.exit(1)
    else:
        target_date = datetime.now().date()

    target_date_str = target_date.strftime("%Y-%m-%d")

    # Seed the RNG unconditionally from the target date so output is
    # reproducible across processes even when no region has subregion data
    # (get_subregion_for_date re-seeds per (region, date) when subregions
    # exist; this seed covers the subregion-less path). Never re-seed from
    # system time afterwards.
    random.seed(
        int(
            hashlib.sha256(f"audio-birdle:{target_date_str}".encode()).hexdigest()[:16],
            16,
        )
    )

    print(f"Generating daily birds for {target_date_str}")
    print(f"Avoiding repeats within {args.days} days")

    # Load subregions data if provided
    subregions_data = {}
    if args.subregions:
        subregions_path = Path(args.subregions)
        if subregions_path.exists():
            subregions_data = load_json_file(subregions_path)
            print(f"Loaded subregions data from {args.subregions}")
        else:
            print(
                f"Warning: Subregions file {args.subregions} not found, proceeding without subregion filtering"
            )

    # Load data files
    regions = load_json_file(regions_path)
    birds_data = load_json_file(birds_path)
    history = load_json_file(history_path)
    current_daily = load_json_file(daily_path)

    # Detect virtual regions (regions with parentRegion field)
    virtual_regions = {
        region["id"]: {
            "parent": region["parentRegion"],
            "excludedSubregions": region.get("excludedSubregions", []),
        }
        for region in regions
        if "parentRegion" in region
    }

    # Print detected virtual regions
    for region_id, region_info in virtual_regions.items():
        print(
            f"Detected virtual region: {region_id} -> parent: {region_info['parent']}"
        )

    # Recover yesterday's answers into history from the persisted daily.json
    # before regenerating today's entries (daily entries carry the bird id).
    history = update_history(
        history, current_daily, target_date, birds_data, virtual_regions
    )

    # Upsert today's entries into the existing daily list so prior dates are
    # preserved: missed runs are recoverable and past dates replayable.
    daily_by_key = {}
    for entry in current_daily:
        daily_by_key[(entry.get("region"), entry.get("date"))] = entry

    # A local day N anywhere on Earth starts as early as 10:00 UTC of day N-1
    # (UTC+14), while entries are published at ~04:00 UTC. Generating a
    # rolling window of [D-1, D, D+1] guarantees entry N already exists at
    # every user's local midnight, so the frontend's "latest entry <= local
    # today" lookup serves exactly the local date's puzzle everywhere. Only
    # MISSING dates are generated (skip-existing): re-runs are idempotent,
    # and a missed run is healed by the next run's D-1 backfill. Selection is
    # deterministic per (region, date), so a healed entry is identical to
    # what the missed run would have produced.
    generation_dates = [target_date + timedelta(days=offset) for offset in (-1, 0, 1)]

    for region in regions:
        region_id = region["id"]
        region_name = region["name"]

        print(f"\nProcessing region: {region_name} ({region_id})")

        if region_id not in history:
            history[region_id] = []

        for generation_date in generation_dates:
            generation_date_str = generation_date.strftime("%Y-%m-%d")

            # Skip dates that already have an entry: re-runs are idempotent
            # and an existing answer is never changed after the fact.
            if (region_id, generation_date_str) in daily_by_key:
                print(
                    f"  {generation_date_str}: entry already exists, keeping existing"
                )
                continue

            # Get birds for this region (handle virtual regions) and the
            # subregion filter for this date (deterministic per region+date).
            region_birds, selected_subregion, subregion_bird_ids = build_region_birds(
                region_id,
                birds_data,
                virtual_regions,
                subregions_data,
                generation_date,
            )

            if not region_birds:
                print(f"  {generation_date_str}: No birds found for region {region_id}")
                continue

            if selected_subregion:
                # Filter region birds by subregion
                subregion_filtered_birds = filter_birds_by_subregion(
                    region_birds, subregion_bird_ids
                )
                print(
                    f"  {generation_date_str}: After subregion filtering: "
                    f"{len(subregion_filtered_birds)} birds available"
                )

            # Get recent answers for this region up to this date
            recent_answers = get_recent_answers(
                history, region_id, args.days, generation_date
            )

            # Select a bird
            selected_bird = select_bird_for_region(
                region_birds,
                recent_answers,
                subregion_bird_ids if selected_subregion else None,
                birds_data,
                region_id,
                virtual_regions,
            )

            if not selected_bird:
                print(
                    f"  {generation_date_str}: Could not select a bird for region {region_id}"
                )
                continue

            bird_hash = hash_bird_id(selected_bird["id"])

            print(
                f"  {generation_date_str}: Selected {selected_bird['name']} "
                f"({selected_bird['id']}) -> {bird_hash}"
            )

            # Add to daily data. "id" is an additive field the frontend
            # ignores; it lets update_history recover the bird on later runs.
            daily_entry = {
                "date": generation_date_str,
                "region": region_id,
                "answerHash": bird_hash,
                "id": selected_bird["id"],
            }

            # Add subregion info if available
            if selected_subregion:
                daily_entry["subregion"] = selected_subregion

            daily_by_key[(region_id, generation_date_str)] = daily_entry

            # Add this date's selection to history, upserting by (region,
            # date) so re-running for the same date replaces rather than
            # duplicates.
            history_entry = {
                "date": generation_date_str,
                "id": selected_bird["id"],
                "name": selected_bird["name"],
            }

            if selected_subregion:
                history_entry["subregion"] = selected_subregion

            for idx, existing in enumerate(history[region_id]):
                if existing.get("date") == generation_date_str:
                    history[region_id][idx] = history_entry
                    break
            else:
                history[region_id].append(history_entry)

        # Keep only recent history (optional cleanup)
        cutoff_date = target_date - timedelta(
            days=args.days * 2
        )  # Keep double the avoidance period
        history[region_id] = [
            entry
            for entry in history[region_id]
            if datetime.strptime(entry["date"], "%Y-%m-%d").date() > cutoff_date
        ]

    # Keep daily.json bounded: prune entries older than 120 days before the
    # target date, then emit in canonical (date, region) order for stable,
    # byte-identical output.
    prune_cutoff = target_date - timedelta(days=120)
    new_daily = [
        entry
        for entry in daily_by_key.values()
        if datetime.strptime(entry["date"], "%Y-%m-%d").date() >= prune_cutoff
    ]
    new_daily.sort(key=lambda entry: (entry["date"], entry["region"]))

    # Save updated files
    save_json_file(daily_path, new_daily)
    save_json_file(history_path, history)

    print(f"\n✓ Generated daily.json with {len(new_daily)} entries")
    print("✓ Updated history.json")
    print(f"✓ Files saved to {base_path}")

    # Display summary
    print("\nGenerated entries:")
    for entry in new_daily:
        subregion_info = (
            f" (subregion: {entry['subregion']})" if "subregion" in entry else ""
        )
        print(
            f"  {entry['region']}: {entry['answerHash']} ({entry['date']}){subregion_info}"
        )


if __name__ == "__main__":
    main()
