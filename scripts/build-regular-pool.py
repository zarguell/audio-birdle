#!/usr/bin/env python3
"""Build a year-round regular-species pool for a region.

The daily play pool must include summer migrants and winter visitors, not
just whatever is present during a single 14-day audit window. This script
samples a short window in each of the last N months (default 12), keeps
species that meet the observation threshold in any one month, and writes a
subregion -> species-list mapping.

The output is consumed by generate-daily-region-data.py through its sibling
``<region>-regular-species.json`` convention.

Example:
    python scripts/build-regular-pool.py \
        --region GB \
        --subregions-file scripts/data/regions/gb-subregions.json \
        --output scripts/data/regions/gb-regular-species.json
"""

from __future__ import annotations

import argparse
import calendar
import json
import time
from dataclasses import dataclass
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Sequence

import requests

import ebird_api_common

EBIRD_BASE = "https://api.ebird.org/v2"


@dataclass(frozen=True)
class PoolOptions:
    api_key: str
    min_observations: int
    min_days: int
    delay: float


def month_windows(
    today: date, months: int, window_days: int, step: int = 1
) -> list[list[date]]:
    """Return one short, past-only sampling window per sampled month.

    ``step=2`` samples every other month, so ``months=6`` covers a full year
    with six windows instead of six consecutive months.
    """
    end = today - timedelta(days=1)
    year, month = end.year, end.month
    windows: list[list[date]] = []

    for _ in range(months):
        month_end = date(year, month, calendar.monthrange(year, month)[1])
        anchor = min(month_end, date(year, month, 21), end)
        start = max(anchor - timedelta(days=window_days - 1), date(year, month, 1))
        windows.append(
            [
                start + timedelta(days=offset)
                for offset in range((anchor - start).days + 1)
            ]
        )
        month -= step
        while month < 1:
            month += 12
            year -= 1

    return windows


def _fetch_one_day(
    code: str, day: date, *, api_key: str
) -> tuple[list[Any] | None, str | None]:
    """Fetch one region-day, returning a payload or an error message."""
    url = f"{EBIRD_BASE}/data/obs/{code}/historic/{day.year}/{day.month}/{day.day}"
    try:
        payload = ebird_api_common.get_json(url, api_key=api_key, timeout=20)
    except (requests.RequestException, ValueError) as error:
        return None, f"{day}: {error}"
    if not isinstance(payload, list):
        return None, f"{day}: response was not an array"
    return payload, None


def _record_observations(
    payload: Sequence[Any],
    day: date,
    counts: Counter[str],
    seen_days: defaultdict[str, set[date]],
) -> None:
    """Accumulate valid observations from one day."""
    for observation in payload:
        if not isinstance(observation, dict):
            continue
        if observation.get("obsValid") is False:
            continue
        species = observation.get("speciesCode")
        if isinstance(species, str):
            counts[species] += 1
            seen_days[species].add(day)


def _should_stop(successful_days: set[date], errors: list[str]) -> bool:
    """Stop a month early when every attempted day has failed."""
    return not successful_days and len(errors) >= 3


def fetch_observation_counts(
    code: str,
    dates: Sequence[date],
    *,
    api_key: str,
    delay: float,
) -> tuple[Counter[str], defaultdict[str, set[date]], set[date], list[str]]:
    """Fetch and count observations for a subregion across several days."""
    counts: Counter[str] = Counter()
    seen_days: defaultdict[str, set[date]] = defaultdict(set)
    successful_days: set[date] = set()
    errors: list[str] = []

    for day in dates:
        payload, error = _fetch_one_day(code, day, api_key=api_key)
        if error:
            # eBird's historic endpoint times out on some high-volume days.
            # Keep the days that do work rather than losing the whole month.
            errors.append(error)
            if _should_stop(successful_days, errors):
                errors.append("skipped remaining dates after 3 early failures")
                break
            continue

        successful_days.add(day)
        _record_observations(payload or [], day, counts, seen_days)
        if delay > 0:
            time.sleep(delay)

    return counts, seen_days, successful_days, errors


def regular_from_counts(
    counts: Counter[str],
    seen_days: defaultdict[str, set[date]],
    *,
    min_observations: int,
    min_days: int,
) -> list[str]:
    """Select species that meet both observation thresholds."""
    return sorted(
        species
        for species, count in counts.items()
        if count >= min_observations and len(seen_days[species]) >= min_days
    )


def build_pool(
    subregions: list[dict[str, str]],
    windows: list[list[date]],
    options: PoolOptions,
) -> dict[str, list[str]]:
    """Union each subregion's regular species across the sampled months."""
    pool: dict[str, set[str]] = {sub["name"]: set() for sub in subregions}

    for window in windows:
        label = f"{window[0]:%Y-%m-%d}..{window[-1]:%Y-%m-%d}"
        for subregion in subregions:
            code = subregion["code"]
            name = subregion["name"]
            print(f"  {label} {name} ({code})", flush=True)
            counts, seen_days, successful_days, errors = fetch_observation_counts(
                code,
                window,
                api_key=options.api_key,
                delay=options.delay,
            )
            if errors:
                print(
                    f"  Warning: {name} {label}: {len(errors)} day(s) failed; "
                    f"using {len(successful_days)} successful day(s)"
                )
            if len(successful_days) < options.min_days:
                print(f"  Skipping {name} {label}: not enough successful days")
                continue
            pool[name].update(
                regular_from_counts(
                    counts,
                    seen_days,
                    min_observations=options.min_observations,
                    min_days=options.min_days,
                )
            )

    return {name: sorted(species) for name, species in pool.items()}


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Build a year-round regular-species pool for one region."
    )
    parser.add_argument("--region", required=True, help="eBird country code, e.g. GB")
    parser.add_argument(
        "--subregions-file",
        type=Path,
        required=True,
        help="Subregion list (same shape as *-subregions.json)",
    )
    parser.add_argument("--months", type=int, default=12)
    parser.add_argument(
        "--month-step",
        type=int,
        default=1,
        help="Months between samples; use 2 with --months 6 for a full year",
    )
    parser.add_argument("--window-days", type=int, default=7)
    parser.add_argument("--min-observations", type=int, default=5)
    parser.add_argument("--min-days", type=int, default=3)
    parser.add_argument("--delay", type=float, default=0.2)
    parser.add_argument("--min-species", type=int, default=1)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(argv)


def load_subregions(path: Path) -> list[dict[str, str]] | None:
    """Load and validate a subregion list file."""
    try:
        subregions = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"Could not read subregions: {error}")
        return None
    if not isinstance(subregions, list) or not subregions:
        print("Subregions file must contain a non-empty array")
        return None
    return subregions


def write_pool(pool: dict[str, list[str]], output: Path, min_species: int) -> bool:
    """Write the pool, rejecting regions that are too thin."""
    thin = [name for name, species in pool.items() if len(species) < min_species]
    if thin:
        print(f"Refusing to write: too few species in {', '.join(thin)}")
        return False

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(pool, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote {output}")
    for name, species in pool.items():
        print(f"  {name}: {len(species)} species")

    union = set().union(*(set(species) for species in pool.values()))
    print(f"Union: {len(union)} species")
    return True


def run(args: argparse.Namespace) -> int:
    """Build and write a pool from parsed arguments."""
    subregions = load_subregions(args.subregions_file)
    if subregions is None:
        return 2

    windows = month_windows(
        datetime.now(timezone.utc).date(),
        args.months,
        args.window_days,
        args.month_step,
    )
    print(
        f"Sampling {len(windows)} monthly windows for "
        f"{len(subregions)} subregions in {args.region.upper()}"
    )

    try:
        pool = build_pool(
            subregions,
            windows,
            PoolOptions(
                api_key=ebird_api_common.load_api_key(),
                min_observations=args.min_observations,
                min_days=args.min_days,
                delay=args.delay,
            ),
        )
    except RuntimeError as error:
        print(f"Pool build failed: {error}")
        return 2

    return 0 if write_pool(pool, args.output, args.min_species) else 2


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point."""
    return run(parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
