#!/usr/bin/env python3
"""Audit a candidate country before adding it to Audio-Birdle.

This script is read-only with respect to production data. It fetches the
country's eBird species and subregion lists, filters the local taxonomy, and
checks Xeno-canto audio coverage using the same quality/length filters as the
production audio pipeline.

Example:
    python scripts/region-audit.py --region CA --output region-audits/ca.json
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

import requests

import ebird_api_common

SCRIPTS_DIR = Path(__file__).resolve().parent
DEFAULT_TAXONOMY = SCRIPTS_DIR / "data" / "ebird-taxonomy.json"
EBIRD_BASE = "https://api.ebird.org/v2"


def _load_xc_module():
    spec = importlib.util.spec_from_file_location(
        "xc_audio_fetch_audit",
        SCRIPTS_DIR / "xc-audio-fetch.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load scripts/xc-audio-fetch.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


XC = _load_xc_module()


def load_species_codes(region: str, species_file: Path | None = None) -> list[str]:
    """Load the eBird species-code list for a country."""
    if species_file:
        payload = _read_json(species_file)
        codes = _extract_codes(payload)
    else:
        api_key = ebird_api_common.load_api_key()
        payload = ebird_api_common.get_json(
            f"{EBIRD_BASE}/product/spplist/{region.upper()}",
            api_key=api_key,
        )
        codes = _extract_codes(payload)

    if not codes:
        raise ValueError(f"No species codes found for region {region}")
    return sorted(codes)


def _extract_codes(payload: Any) -> set[str]:
    if not isinstance(payload, list):
        raise ValueError("Species data must be a JSON array")
    codes = set()
    for item in payload:
        if isinstance(item, str):
            codes.add(item)
        elif isinstance(item, dict) and item.get("speciesCode"):
            codes.add(item["speciesCode"])
    return codes


def load_subregions(
    region: str,
    subregions_file: Path | None = None,
    skip: bool = False,
) -> tuple[list[dict[str, str]], str | None]:
    """Load subnational1 regions (states/provinces) for a country."""
    if skip:
        return [], None
    if subregions_file:
        payload = _read_json(subregions_file)
        if not isinstance(payload, list):
            raise ValueError("Subregions data must be a JSON array")
        return _normalize_subregions(payload), None

    api_key = ebird_api_common.load_api_key()
    try:
        payload = ebird_api_common.get_json(
            f"{EBIRD_BASE}/ref/region/list/subnational1/{region.upper()}",
            api_key=api_key,
        )
    except requests.RequestException as error:
        return [], str(error)
    if not isinstance(payload, list):
        return [], "Subregion response was not an array"
    return _normalize_subregions(payload), None


def _normalize_subregions(payload: list[Any]) -> list[dict[str, str]]:
    subregions = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        code = item.get("code")
        name = item.get("name")
        if isinstance(code, str) and isinstance(name, str):
            subregions.append({"code": code, "name": name})
    return subregions


def load_taxonomy(
    taxonomy_file: Path,
    species_codes: Sequence[str],
    include_non_species: bool = False,
) -> tuple[list[dict[str, Any]], list[str], int]:
    """Filter the local taxonomy to a country's species codes."""
    taxonomy = _read_json(taxonomy_file)
    if not isinstance(taxonomy, list):
        raise ValueError("Taxonomy data must be a JSON array")

    wanted = set(species_codes)
    matched: list[dict[str, Any]] = []
    found: set[str] = set()
    excluded = 0
    for entry in taxonomy:
        if not isinstance(entry, dict):
            continue
        code = entry.get("speciesCode")
        if code not in wanted:
            continue
        found.add(code)
        category = entry.get("category", "species")
        if not include_non_species and category != "species":
            excluded += 1
            continue
        if not entry.get("sciName") or not entry.get("comName"):
            continue
        matched.append(entry)

    missing = sorted(wanted - found)
    matched.sort(key=lambda entry: str(entry.get("comName", "")).lower())
    return matched, missing, excluded


def audit_audio(
    taxonomy: list[dict[str, Any]],
    country_name: str,
    *,
    api_key: str,
    tag: str,
    min_quality: str,
    min_length_sec: int,
    max_length_sec: int,
    max_urls: int,
    max_pages: int,
    delay: float,
    any_type_fallback: bool,
    limit: int | None = None,
) -> dict[str, Any]:
    """Check Xeno-canto coverage for every taxonomy entry."""
    entries = taxonomy[:limit] if limit else taxonomy
    quality_counts: Counter[str] = Counter()
    license_counts: Counter[str] = Counter()
    missing_audio: list[dict[str, str]] = []
    errors: list[dict[str, str]] = []
    species_with_audio = 0
    clips_selected = 0

    for index, entry in enumerate(entries, start=1):
        code = str(entry.get("speciesCode", ""))
        name = str(entry.get("comName", ""))
        scientific = str(entry.get("sciName", ""))
        try:
            recordings = XC.fetch_recordings(
                scientific,
                country=country_name,
                sound_type=tag,
                api_key=api_key,
                max_pages=max_pages,
            )
            if any_type_fallback and not recordings:
                recordings = XC.fetch_recordings(
                    scientific,
                    country=country_name,
                    sound_type=None,
                    api_key=api_key,
                    max_pages=max_pages,
                )
            selected = XC.select_recordings(
                recordings,
                sound_type=tag,
                min_quality=min_quality,
                min_length_sec=min_length_sec,
                max_length_sec=max_length_sec,
                max_urls=max_urls,
            )
        except (requests.RequestException, ValueError, TypeError, KeyError) as error:
            errors.append({"id": code, "name": name, "error": str(error)})
            selected = []

        if selected:
            species_with_audio += 1
            clips_selected += len(selected)
            for recording in selected:
                quality_counts[str(recording.get("q", "?")).upper()] += 1
                license_counts[str(recording.get("lic", "unknown"))] += 1
        else:
            missing_audio.append(
                {"id": code, "name": name, "scientificName": scientific}
            )

        if index % 25 == 0:
            print(
                f"  audio {index}/{len(entries)} "
                f"({species_with_audio} with audio, {len(errors)} errors)",
                flush=True,
            )
        if index < len(entries) and delay > 0:
            time.sleep(delay)

    checked = len(entries)
    coverage = (species_with_audio / checked * 100) if checked else 0.0
    return {
        "species_checked": checked,
        "species_with_audio": species_with_audio,
        "coverage_pct": round(coverage, 1),
        "clips_selected": clips_selected,
        "quality_counts": dict(sorted(quality_counts.items())),
        "license_counts": dict(sorted(license_counts.items())),
        "missing_audio": missing_audio,
        "errors": errors,
    }


def build_report(
    *,
    region: str,
    country_name: str,
    species_codes: list[str],
    subregions: list[dict[str, str]],
    subregion_error: str | None,
    taxonomy: list[dict[str, Any]],
    taxonomy_missing: list[str],
    excluded_non_species: int,
    audio: dict[str, Any] | None,
    params: dict[str, Any],
    target_coverage: float,
    min_playable_species: int,
    partial: bool,
) -> dict[str, Any]:
    coverage = audio["coverage_pct"] if audio else None
    playable = audio["species_with_audio"] if audio else 0
    ready = bool(
        audio
        and not partial
        and coverage is not None
        and coverage >= target_coverage
        and playable >= min_playable_species
        and not audio["errors"]
        and not taxonomy_missing
        and not subregion_error
    )
    if audio is None:
        recommendation = "Audio audit skipped; run without --skip-audio first."
    elif partial:
        recommendation = "Partial audit only; rerun without --limit before deciding."
    elif audio["errors"]:
        recommendation = "Xeno-canto errors occurred; rerun before enabling the region."
    elif taxonomy_missing:
        recommendation = "Some eBird species are absent from the local taxonomy."
    elif coverage >= target_coverage:
        recommendation = (
            "Coverage meets the target. Review missing species and proceed."
        )
    else:
        recommendation = "Coverage is below target; improve audio coverage first."

    return {
        "region": region.lower(),
        "region_name": country_name,
        "generated_at": _utc_now(),
        "target_coverage_pct": target_coverage,
        "min_playable_species": min_playable_species,
        "ready": ready,
        "recommendation": recommendation,
        "parameters": params,
        "ebird": {
            "species_count": len(species_codes),
            "subregion_count": len(subregions),
            "subregions": subregions,
            "subregion_error": subregion_error,
        },
        "taxonomy": {
            "matched_species": len(taxonomy),
            "missing_species_codes": taxonomy_missing,
            "excluded_non_species": excluded_non_species,
        },
        "audio": audio,
    }


def format_summary(report: dict[str, Any]) -> str:
    audio = report["audio"]
    lines = [
        f"Region: {report['region']} ({report['region_name']})",
        f"eBird species: {report['ebird']['species_count']}",
        f"Taxonomy matched: {report['taxonomy']['matched_species']}"
        f" (missing {len(report['taxonomy']['missing_species_codes'])})",
        f"Subregions: {report['ebird']['subregion_count']}",
    ]
    if audio is None:
        lines.append("Audio: skipped")
    else:
        lines.extend(
            [
                f"Audio coverage: {audio['species_with_audio']}/"
                f"{audio['species_checked']} ({audio['coverage_pct']}%)"
                f" target {report['target_coverage_pct']}%",
                f"Playable species target: {report['min_playable_species']}",
                f"Clips selected: {audio['clips_selected']}",
                f"Quality: {audio['quality_counts']}",
                f"Licenses: {audio['license_counts']}",
                f"Missing audio: {len(audio['missing_audio'])}",
                f"Xeno-canto errors: {len(audio['errors'])}",
            ]
        )
    lines.append(f"Ready: {'yes' if report['ready'] else 'no'}")
    lines.append(f"Next: {report['recommendation']}")
    return "\n".join(lines)


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _write_report(report: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Report written to {output}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit eBird/Xeno-canto coverage for a candidate country."
    )
    parser.add_argument("--region", required=True, help="eBird country code, e.g. CA")
    parser.add_argument(
        "--taxonomy",
        type=Path,
        default=DEFAULT_TAXONOMY,
        help=f"Local taxonomy JSON (default: {DEFAULT_TAXONOMY})",
    )
    parser.add_argument("--species-file", type=Path, help="Offline eBird species list")
    parser.add_argument("--subregions-file", type=Path, help="Offline subregion list")
    parser.add_argument("--skip-subregions", action="store_true")
    parser.add_argument("--skip-audio", action="store_true")
    parser.add_argument("--include-non-species", action="store_true")
    parser.add_argument("--tag", default="song", help="Preferred XC sound type")
    parser.add_argument(
        "--min-quality",
        choices=sorted(XC.QUALITY_RANK),
        default="C",
    )
    parser.add_argument("--min-length-sec", type=int, default=5)
    parser.add_argument("--max-length-sec", type=int, default=360)
    parser.add_argument("--max-urls", type=int, default=10)
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--limit", type=int, help="Audit only the first N species")
    parser.add_argument("--target-coverage", type=float, default=50.0)
    parser.add_argument("--min-playable-species", type=int, default=300)
    parser.add_argument("--output", type=Path, help="Write the full JSON report")
    parser.add_argument("--country-name", help="Override the XC country filter")
    parser.add_argument(
        "--no-any-type-fallback",
        dest="any_type_fallback",
        action="store_false",
        default=True,
    )
    args = parser.parse_args(argv)

    region = args.region.upper()
    country_name = args.country_name or XC.COUNTRY_NAMES.get(region, region)
    params = {
        "tag": args.tag,
        "min_quality": args.min_quality,
        "min_length_sec": args.min_length_sec,
        "max_length_sec": args.max_length_sec,
        "max_urls": args.max_urls,
        "max_pages": args.max_pages,
        "any_type_fallback": args.any_type_fallback,
        "limit": args.limit,
        "skip_audio": args.skip_audio,
    }

    try:
        species_codes = load_species_codes(region, args.species_file)
        subregions, subregion_error = load_subregions(
            region,
            args.subregions_file,
            args.skip_subregions,
        )
        taxonomy, taxonomy_missing, excluded_non_species = load_taxonomy(
            args.taxonomy,
            species_codes,
            args.include_non_species,
        )
        audio = None
        if not args.skip_audio:
            audio = audit_audio(
                taxonomy,
                country_name,
                api_key=XC.load_api_key(),
                tag=args.tag,
                min_quality=args.min_quality,
                min_length_sec=args.min_length_sec,
                max_length_sec=args.max_length_sec,
                max_urls=args.max_urls,
                max_pages=args.max_pages,
                delay=args.delay,
                any_type_fallback=args.any_type_fallback,
                limit=args.limit,
            )
    except (ValueError, OSError) as error:
        print(f"Audit failed: {error}", file=sys.stderr)
        return 2

    report = build_report(
        region=region,
        country_name=country_name,
        species_codes=species_codes,
        subregions=subregions,
        subregion_error=subregion_error,
        taxonomy=taxonomy,
        taxonomy_missing=taxonomy_missing,
        excluded_non_species=excluded_non_species,
        audio=audio,
        params=params,
        target_coverage=args.target_coverage,
        min_playable_species=args.min_playable_species,
        partial=bool(args.limit),
    )
    if args.output:
        _write_report(report, args.output)
    print(format_summary(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
