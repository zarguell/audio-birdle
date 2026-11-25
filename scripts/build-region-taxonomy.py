#!/usr/bin/env python3
"""Build a region-scoped taxonomy snapshot from a current eBird taxonomy.

Keeping one current taxonomy per region lets a new country use eBird's latest
species codes without refreshing (and potentially breaking) the US/GB data.
Old species codes stay in the existing region snapshots; new regions get new
codes such as split species.

Example:
    python scripts/build-region-taxonomy.py \
        --region CA \
        --species-file scripts/data/regions/ca-regular-species.json \
        --taxonomy-file /tmp/ebird-taxonomy-current.json \
        --output scripts/data/regions/ca-taxonomy.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = ("speciesCode", "comName", "sciName", "category")


def _codes_from_list(data: list[Any]) -> set[str]:
    codes = set()
    for item in data:
        if isinstance(item, str):
            codes.add(item)
        elif isinstance(item, dict) and isinstance(item.get("id"), str):
            codes.add(item["id"])
    return codes


def _codes_from_mapping(data: dict[str, Any]) -> set[str]:
    codes: set[str] = set()
    for value in data.values():
        if isinstance(value, list):
            codes.update(item for item in value if isinstance(item, str))
    return codes


def load_species_codes(path: Path) -> set[str]:
    """Accept a list of codes or a subregion -> list mapping."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        codes = _codes_from_list(data)
    elif isinstance(data, dict):
        codes = _codes_from_mapping(data)
    else:
        codes = set()
    if not codes:
        raise ValueError(f"No species codes found in {path}")
    return codes


def filter_taxonomy(
    taxonomy: list[Any],
    codes: set[str],
    *,
    include_non_species: bool = False,
) -> tuple[list[dict[str, Any]], list[str], int]:
    """Filter a full taxonomy to the requested codes."""
    filtered: list[dict[str, Any]] = []
    found: set[str] = set()
    excluded = 0

    for entry in taxonomy:
        if not isinstance(entry, dict):
            continue
        code = entry.get("speciesCode")
        if code not in codes:
            continue
        found.add(code)
        if not include_non_species and entry.get("category") != "species":
            excluded += 1
            continue
        if any(not entry.get(field) for field in REQUIRED_FIELDS):
            continue
        filtered.append(entry)

    missing = sorted(codes - found)
    filtered.sort(key=lambda entry: str(entry.get("comName", "")).lower())
    return filtered, missing, excluded


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a region taxonomy snapshot from current eBird taxonomy."
    )
    parser.add_argument("--region", required=True, help="Region code, e.g. CA")
    parser.add_argument("--species-file", type=Path, required=True)
    parser.add_argument("--taxonomy-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--include-non-species",
        action="store_true",
        help="Include hybrids, slashes, and other non-species categories",
    )
    args = parser.parse_args()

    try:
        codes = load_species_codes(args.species_file)
        taxonomy = json.loads(args.taxonomy_file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"Could not load inputs: {error}")
        return 2
    if not isinstance(taxonomy, list):
        print("Taxonomy file must contain a JSON array")
        return 2

    filtered, missing, excluded = filter_taxonomy(
        taxonomy, codes, include_non_species=args.include_non_species
    )
    if missing:
        print(f"Missing from taxonomy: {', '.join(missing)}")
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(filtered, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.output}")
    print(
        f"Region {args.region.upper()}: {len(filtered)} species "
        f"({excluded} non-species excluded)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
