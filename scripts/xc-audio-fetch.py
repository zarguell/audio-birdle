#!/usr/bin/env python3
"""
Fetch bird audio URLs (with metadata) from the Xeno-canto API v3.

This is the API-based replacement for ebird-songdownload.py. The Macaulay
Library / eBird media catalog can no longer be scraped anonymously: media
search results are gated behind CAS login, so the Selenium-based approach
stopped being viable. Xeno-canto offers a documented JSON API that returns
direct MP3 URLs plus the metadata this project wants for attribution:
quality rating, recordist, license, recording date/location and background
species.

API docs: https://xeno-canto.org/explore/api
A free API key is required (any registered XC member with a verified
email can see theirs at https://xeno-canto.org/account). Provide it via
the XC_API_KEY environment variable or a .env file.

Output is written to ``<taxonomy_stem>-urls.json`` in the same record
format game-data-generator.py consumes (``code`` / ``page Url`` /
``audio Url`` keys) with additional metadata keys that
game-data-generator.py turns into per-clip attribution objects.

Usage:
    XC_API_KEY=... python3 xc-audio-fetch.py \\
        data/regions/us-taxonomy.json --country US --tag song --max-urls 10
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

API_URL = "https://xeno-canto.org/api/3/recordings"

# Quality rank for sorting (A is best). Unrated recordings sort last.
QUALITY_RANK = {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}

# Preferred clip duration window (seconds) used as a tie-breaker when
# several recordings share the same quality rating.
PREFERRED_LENGTH_RANGE = (15, 90)

# ISO-ish country codes commonly used by this project -> Xeno-canto
# country names (the cnt: search tag expects full names).
COUNTRY_NAMES = {
    "US": "United States",
    "CA": "Canada",
    "GB": "United Kingdom",
    "AU": "Australia",
    "DE": "Germany",
    "FR": "France",
    "ES": "Spain",
    "IT": "Italy",
    "NL": "Netherlands",
    "PT": "Portugal",
    "MX": "Mexico",
    "BR": "Brazil",
    "AR": "Argentina",
    "IN": "India",
    "JP": "Japan",
    "NZ": "New Zealand",
    "ZA": "South Africa",
}


def load_api_key(cli_key=None):
    """Load the Xeno-canto API key from CLI, .env or the environment.

    Raises:
        ValueError: if no key is available anywhere.
    """
    if cli_key:
        return cli_key
    load_dotenv()
    api_key = os.environ.get("XC_API_KEY")
    if not api_key:
        raise ValueError(
            "XC_API_KEY not found. Register at xeno-canto.org and copy "
            "your key from https://xeno-canto.org/account into .env or "
            "the environment."
        )
    return api_key


def get_json(url, params, api_key, retries=3, timeout=30):
    """GET a JSON document with retries and exponential backoff.

    Backoff sleeps 1s, 2s, 4s between attempts and raises the last error
    on final failure (mirrors ebird_api_common.get).

    Returns:
        dict: parsed JSON response.

    Raises:
        requests.RequestException: if every attempt fails.
    """
    last_error = None
    for attempt in range(retries):
        try:
            response = requests.get(
                url,
                params=params,
                headers={"X-API-KEY": api_key},
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as error:
            last_error = error
            if attempt < retries - 1:
                time.sleep(2**attempt)
    raise last_error


def parse_length(length):
    """Parse an XC length string ("4:08", "1:02:33") into seconds.

    Returns:
        int: duration in seconds, or None when unparseable.
    """
    if not length:
        return None
    parts = str(length).split(":")
    try:
        seconds = 0
        for part in parts:
            seconds = seconds * 60 + int(part)
        return seconds
    except ValueError:
        return None


def build_query(sci_name, country=None, sound_type=None):
    """Build an XC API v3 search query string.

    Args:
        sci_name: Scientific name (matched exactly via the sp: tag).
        country: Optional Xeno-canto country name for the cnt: tag.
        sound_type: Optional sound type for the type: tag (e.g. "song").

    Returns:
        str: query string suitable for the query= parameter.
    """
    terms = [f'sp:"{sci_name}"', "grp:birds"]
    if country:
        terms.append(f'cnt:"{country}"')
    if sound_type:
        terms.append(f"type:{sound_type}")
    return " ".join(terms)


def fetch_recordings(
    sci_name, country=None, sound_type=None, api_key=None,
    max_pages=2, per_page=100,
):
    """Fetch recordings for one species from the XC API.

    Args:
        sci_name: Scientific name to query.
        country: Optional country name filter.
        sound_type: Optional sound type filter.
        api_key: Xeno-canto API key.
        max_pages: Maximum number of result pages to fetch.
        per_page: Results per page (XC allows 50-500).

    Returns:
        list: Raw recording objects.
    """
    query = build_query(sci_name, country, sound_type)
    recordings = []
    page = 1
    while page <= max_pages:
        payload = get_json(
            API_URL,
            {"query": query, "key": api_key, "page": page,
             "per_page": per_page},
            api_key,
        )
        batch = payload.get("recordings", [])
        recordings.extend(batch)
        num_pages = int(payload.get("numPages", 1) or 1)
        if page >= num_pages or not batch:
            break
        page += 1
    return recordings


def is_restricted(recording):
    """Check whether a recording's file is redacted (restricted species)."""
    meta = recording.get("_meta")
    if isinstance(meta, dict):
        redacted = meta.get("redacted_fields", {})
        if "file" in redacted:
            return True
    return not recording.get("file")


def matches_sound_type(recording, sound_type):
    """Check whether a recording's free-text type matches the filter.

    XC "type" is free text ("song", "call", "call, song", "flight
    call", ...), so match on lowercase substring.
    """
    if not sound_type:
        return True
    return sound_type.lower() in str(recording.get("type", "")).lower()


def length_score(seconds):
    """Score a clip's duration: 0 inside the preferred window, otherwise
    the distance from it (smaller is better)."""
    if seconds is None:
        return 10**6
    low, high = PREFERRED_LENGTH_RANGE
    if seconds < low:
        return low - seconds
    if seconds > high:
        return seconds - high
    return 0


def select_recordings(
    recordings, sound_type=None, min_quality="C",
    min_length_sec=5, max_length_sec=360, max_urls=10,
):
    """Filter and rank recordings for inclusion in the game data.

    Sorts by quality (best first), then preferred sound type, then
    duration inside the preferred window, then XC id for determinism.

    Returns:
        list: The top ``max_urls`` recording objects.
    """
    min_rank = QUALITY_RANK.get(min_quality.upper(), 0)

    def sort_key(recording):
        quality = QUALITY_RANK.get(str(recording.get("q", "")).strip().upper(), 0)
        return (
            -quality,
            0 if matches_sound_type(recording, sound_type) else 1,
            length_score(parse_length(recording.get("length"))),
            int(recording.get("id", 0) or 0),
        )

    eligible = []
    for recording in recordings:
        if is_restricted(recording):
            continue
        quality = str(recording.get("q", "")).strip().upper()
        if QUALITY_RANK.get(quality, 0) < min_rank:
            continue
        if min_length_sec or max_length_sec:
            seconds = parse_length(recording.get("length"))
            if seconds is None:
                continue
            if seconds < min_length_sec or seconds > max_length_sec:
                continue
        eligible.append(recording)

    eligible.sort(key=sort_key)
    return eligible[:max_urls]


def to_output_record(species_code, recording):
    """Convert an XC recording object into a pipeline URL record.

    Keeps the legacy ``code`` / ``page Url`` / ``audio Url`` keys that
    game-data-generator.py consumes, plus metadata keys that become the
    per-clip attribution object.
    """
    return {
        "code": species_code,
        "page Url": recording.get("url", ""),
        "audio Url": recording.get("file", ""),
        "quality": str(recording.get("q", "")).strip().upper(),
        "recordist": recording.get("rec", ""),
        "license": recording.get("lic", ""),
        "recordedOn": recording.get("date", ""),
        "location": recording.get("loc", ""),
        "country": recording.get("cnt", ""),
        "soundType": recording.get("type", ""),
        "backgroundSpecies": recording.get("also", []),
        "source": "xeno-canto",
        "xcId": int(recording.get("id", 0) or 0),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Fetch audio URLs and metadata from the Xeno-canto API v3."
    )
    parser.add_argument(
        "taxonomy_file",
        type=Path,
        help="Path to a taxonomy JSON file (e.g., us-taxonomy.json)",
    )
    parser.add_argument(
        "--country",
        "--region",
        dest="country",
        default="US",
        help="Country name or code for the cnt: filter (default: US). "
        "Pass an empty string to search worldwide.",
    )
    parser.add_argument(
        "--tag",
        type=str,
        default="song",
        help="Preferred sound type (default: song)",
    )
    parser.add_argument(
        "--any-type-fallback",
        action="store_true",
        default=True,
        help="Retry without the sound type filter when a species has no "
        "matching clips (default: enabled)",
    )
    parser.add_argument(
        "--no-any-type-fallback",
        dest="any_type_fallback",
        action="store_false",
        help="Disable the sound type fallback",
    )
    parser.add_argument(
        "--max-urls",
        type=int,
        default=10,
        help="Maximum number of audio URLs per species (default: 10)",
    )
    parser.add_argument(
        "--min-quality",
        choices=sorted(QUALITY_RANK),
        default="C",
        help="Minimum XC quality rating to keep (default: C)",
    )
    parser.add_argument(
        "--min-length-sec",
        type=int,
        default=5,
        help="Minimum clip duration in seconds (default: 5)",
    )
    parser.add_argument(
        "--max-length-sec",
        type=int,
        default=360,
        help="Maximum clip duration in seconds (default: 360)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay between API requests in seconds (default: 1.0)",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=2,
        help="Maximum result pages to fetch per species (default: 2)",
    )
    parser.add_argument(
        "--key",
        type=str,
        default=None,
        help="Xeno-canto API key (defaults to XC_API_KEY env/.env)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output file (default: <taxonomy_stem>-urls.json)",
    )
    args = parser.parse_args()

    try:
        api_key = load_api_key(args.key)
    except ValueError as error:
        print(f"❌ {error}")
        sys.exit(1)

    country = COUNTRY_NAMES.get(args.country.upper(), args.country)
    if args.country:
        print(f"🌍 Filtering by country: {country}")

    try:
        with open(args.taxonomy_file, "r", encoding="utf-8") as file:
            taxonomy = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        print(f"❌ Error loading taxonomy file: {error}")
        sys.exit(1)

    print(f"📊 Processing {len(taxonomy)} species...")

    output_records = []
    species_with_audio = 0
    for index, entry in enumerate(taxonomy, 1):
        species_code = entry.get("speciesCode")
        sci_name = entry.get("sciName")
        if not species_code or not sci_name:
            continue

        print(f"🔍 [{index}/{len(taxonomy)}] {species_code} ({sci_name})")
        try:
            recordings = fetch_recordings(
                sci_name,
                country=country or None,
                sound_type=args.tag,
                api_key=api_key,
                max_pages=args.max_pages,
            )
            if args.any_type_fallback and not recordings:
                # Retry without the sound type restriction so rare
                # species without tagged "song" clips still get audio.
                recordings = fetch_recordings(
                    sci_name,
                    country=country or None,
                    sound_type=None,
                    api_key=api_key,
                    max_pages=args.max_pages,
                )
        except requests.RequestException as error:
            print(f"   ⚠️  API error, skipping: {error}")
            continue

        selected = select_recordings(
            recordings,
            sound_type=args.tag,
            min_quality=args.min_quality,
            min_length_sec=args.min_length_sec,
            max_length_sec=args.max_length_sec,
            max_urls=args.max_urls,
        )

        if selected:
            species_with_audio += 1
            print(f"   ✅ {len(selected)} clips "
                  f"(best quality {selected[0].get('q', '?')})")
            output_records.extend(
                to_output_record(species_code, recording)
                for recording in selected
            )
        else:
            print("   ⚠️  No usable recordings found")

        if index < len(taxonomy) and args.delay > 0:
            time.sleep(args.delay)

    output_file = args.output or args.taxonomy_file.parent / (
        f"{args.taxonomy_file.stem}-urls.json"
    )
    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(output_records, file, indent=2, ensure_ascii=False)

    print("\n📊 Summary:")
    print(f"   Species processed: {len(taxonomy)}")
    print(f"   Species with audio: {species_with_audio}")
    print(f"   Total clips: {len(output_records)}")
    print(f"✅ Audio URLs saved to {output_file}")


if __name__ == "__main__":
    main()
