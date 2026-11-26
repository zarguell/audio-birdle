#!/usr/bin/env python3
"""Assert daily.json covers today and the following days for every region.

The browser's pickDailyEntry() falls back to the most recent entry on or before
the player's local date, so a missing date does not error: it silently replays
the previous day's bird under the new date key. Scheduled generation is
best-effort (GitHub delivers cron runs hours late), so fail loudly here instead
of letting players see a duplicate puzzle.

Usage: python verify-daily-coverage.py [--data-dir DIR] [--timezone TZ] [--days N]
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

DEFAULT_TIMEZONE = "America/New_York"
DEFAULT_DAYS = 2


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Verify daily.json covers the required upcoming days"
    )
    parser.add_argument(
        "--data-dir",
        default="public/data",
        help="Directory containing regions.json and daily.json",
    )
    parser.add_argument(
        "--timezone",
        default=DEFAULT_TIMEZONE,
        help=f"IANA timezone whose calendar day defines 'today' (default: {DEFAULT_TIMEZONE})",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_DAYS,
        help=f"Consecutive days starting today that must be covered (default: {DEFAULT_DAYS})",
    )
    return parser.parse_args(argv)


def load_json(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def find_missing_entries(data_dir, today, days):
    """Return 'region date' strings required by the window but absent."""
    regions = [region["id"] for region in load_json(data_dir / "regions.json")]
    daily = load_json(data_dir / "daily.json")
    present = {(entry.get("region"), entry.get("date")) for entry in daily}

    missing = []
    for offset in range(days):
        day = (today + timedelta(days=offset)).isoformat()
        missing.extend(
            f"{region_id} {day}" for region_id in regions if (region_id, day) not in present
        )
    return missing


def main(argv=None):
    args = parse_args(argv)
    data_dir = Path(args.data_dir)
    today = datetime.now(ZoneInfo(args.timezone)).date()

    missing = find_missing_entries(data_dir, today, args.days)
    if missing:
        print(f"ERROR: {len(missing)} required daily entries are missing:")
        for item in missing:
            print(f"  {item}")
        return 1

    end = (today + timedelta(days=args.days - 1)).isoformat()
    print(f"OK: {data_dir}/daily.json covers every region from {today} through {end}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
