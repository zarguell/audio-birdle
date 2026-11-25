#!/usr/bin/env python3
"""Audit a candidate country before adding it to Audio-Birdle.

This script is read-only with respect to production data. It fetches the
country's eBird species and subregion lists, limits the pool to species seen
regularly enough to be fair game answers, filters the local taxonomy, and
checks Xeno-canto audio coverage using the same quality/length filters as the
production audio pipeline.

Example:
    python scripts/region-audit.py --region CA --output region-audits/ca.json
    python scripts/region-audit.py --region CA --regular-days 0  # raw audit
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
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


def _count_regular_observations(
    code: str,
    dates: Sequence[Any],
    *,
    api_key: str,
    delay: float,
) -> tuple[Counter[str], defaultdict[str, set[Any]], str | None]:
    """Count valid observations and distinct days for one subregion."""
    counts: Counter[str] = Counter()
    seen_days: defaultdict[str, set[Any]] = defaultdict(set)

    for date in dates:
        url = (
            f"{EBIRD_BASE}/data/obs/{code}/historic/{date.year}/{date.month}/{date.day}"
        )
        try:
            payload = ebird_api_common.get_json(url, api_key=api_key)
        except (requests.RequestException, ValueError) as error:
            return counts, seen_days, str(error)

        if not isinstance(payload, list):
            return counts, seen_days, "observation response was not an array"

        for observation in payload:
            if not isinstance(observation, dict):
                continue
            # eBird marks uncertain records with obsValid=false. They are
            # exactly the kind of one-off rarity this filter should drop.
            if observation.get("obsValid") is False:
                continue
            species = observation.get("speciesCode")
            if isinstance(species, str):
                counts[species] += 1
                seen_days[species].add(date)

        if delay > 0:
            time.sleep(delay)

    return counts, seen_days, None


def _regular_from_counts(
    counts: Counter[str],
    seen_days: defaultdict[str, set[Any]],
    min_observations: int,
    min_days: int,
) -> list[str]:
    return sorted(
        species
        for species, count in counts.items()
        if count >= min_observations and len(seen_days[species]) >= min_days
    )


def load_regular_species(
    region: str,
    subregions: list[dict[str, str]],
    *,
    api_key: str,
    days: int,
    min_observations: int,
    min_days: int,
    delay: float,
) -> tuple[set[str], dict[str, list[str]], list[dict[str, str]]]:
    """Find species seen often enough to be fair daily-game answers.

    Rare vagrants can be a single twitch: many observations on one day, or
    one or two records across the whole window. Requiring both a minimum
    observation count and observations on several distinct days keeps them
    out of the candidate pool while retaining resident and regular migrants.
    """
    targets = [(sub["code"], sub["name"]) for sub in subregions]
    if not targets:
        targets = [(region.upper(), region.upper())]

    end = datetime.now(timezone.utc).date()
    dates = [end - timedelta(days=offset) for offset in range(1, days + 1)]
    regular: set[str] = set()
    by_subregion: dict[str, list[str]] = {}
    errors: list[dict[str, str]] = []

    for code, name in targets:
        counts, seen_days, error = _count_regular_observations(
            code, dates, api_key=api_key, delay=delay
        )
        if error:
            errors.append({"region": code, "name": name, "error": error})
            by_subregion[name] = []
            continue

        kept = _regular_from_counts(counts, seen_days, min_observations, min_days)
        by_subregion[name] = kept
        regular.update(kept)

    return regular, by_subregion, errors


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
    playable_ids: list[str] = []
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
            playable_ids.append(code)
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
        "playable_ids": sorted(playable_ids),
        "errors": errors,
    }


def _enrich_subregions(
    subregions: list[dict[str, str]],
    regular_by_subregion: dict[str, list[str]] | None,
    audio: dict[str, Any] | None,
    min_playable_per_subregion: int,
) -> tuple[list[dict[str, Any]], list[str]]:
    enriched = [dict(sub) for sub in subregions]
    thin_subregions: list[str] = []
    if regular_by_subregion is None:
        return enriched, thin_subregions

    playable_ids = set(audio.get("playable_ids", [])) if audio else set()
    for subregion in enriched:
        ids = set(regular_by_subregion.get(subregion["name"], []))
        subregion_playable = len(ids & playable_ids)
        subregion["regular_species_count"] = len(ids)
        subregion["playable_species_count"] = subregion_playable if audio else None
        if audio and subregion_playable < min_playable_per_subregion:
            thin_subregions.append(subregion["name"])
    return enriched, thin_subregions


def _is_ready(
    *,
    audio: dict[str, Any] | None,
    partial: bool,
    target_coverage: float,
    min_playable_species: int,
    taxonomy_missing: list[str],
    regular_errors: list[dict[str, str]],
    regular_filter_used: bool,
    regular_species_count: int | None,
    thin_subregions: list[str],
    subregion_error: str | None,
) -> bool:
    if not audio:
        return False
    coverage = audio["coverage_pct"]
    return bool(
        not partial
        and coverage >= target_coverage
        and audio["species_with_audio"] >= min_playable_species
        and not audio["errors"]
        and not taxonomy_missing
        and not regular_errors
        and not (regular_filter_used and regular_species_count == 0)
        and not thin_subregions
        and not subregion_error
    )


def _recommendation(
    *,
    audio: dict[str, Any] | None,
    partial: bool,
    regular_errors: list[dict[str, str]],
    regular_filter_used: bool,
    regular_species_count: int | None,
    taxonomy_missing: list[str],
    thin_subregions: list[str],
    min_playable_per_subregion: int,
    target_coverage: float,
) -> str:
    if regular_errors:
        return "eBird observation fetch failed; rerun before deciding."
    if audio is None:
        return "Audio audit skipped; run without --skip-audio first."
    if partial:
        return "Partial audit only; rerun without --limit before deciding."
    if regular_filter_used and regular_species_count == 0:
        return (
            "No species passed the regular-species filter; lower its thresholds "
            "or use --regular-days 0."
        )
    if audio["errors"]:
        return "Xeno-canto errors occurred; rerun before enabling the region."
    if taxonomy_missing:
        return "Some regular eBird species are absent from the local taxonomy."
    if thin_subregions:
        return (
            f"{len(thin_subregions)} subregion(s) have fewer than "
            f"{min_playable_per_subregion} playable regular species."
        )
    if audio["coverage_pct"] >= target_coverage:
        return "Coverage meets the target. Review missing species and proceed."
    return "Coverage is below target; improve audio coverage first."


def build_report(
    *,
    region: str,
    country_name: str,
    species_codes: list[str],
    regular_species_count: int | None,
    regular_by_subregion: dict[str, list[str]] | None,
    regular_errors: list[dict[str, str]],
    subregions: list[dict[str, str]],
    subregion_error: str | None,
    taxonomy: list[dict[str, Any]],
    taxonomy_missing: list[str],
    excluded_non_species: int,
    audio: dict[str, Any] | None,
    params: dict[str, Any],
    target_coverage: float,
    min_playable_species: int,
    min_playable_per_subregion: int,
    partial: bool,
) -> dict[str, Any]:
    regular_filter_used = regular_species_count is not None
    enriched_subregions, thin_subregions = _enrich_subregions(
        subregions, regular_by_subregion, audio, min_playable_per_subregion
    )
    ready = _is_ready(
        audio=audio,
        partial=partial,
        target_coverage=target_coverage,
        min_playable_species=min_playable_species,
        taxonomy_missing=taxonomy_missing,
        regular_errors=regular_errors,
        regular_filter_used=regular_filter_used,
        regular_species_count=regular_species_count,
        thin_subregions=thin_subregions,
        subregion_error=subregion_error,
    )
    recommendation = _recommendation(
        audio=audio,
        partial=partial,
        regular_errors=regular_errors,
        regular_filter_used=regular_filter_used,
        regular_species_count=regular_species_count,
        taxonomy_missing=taxonomy_missing,
        thin_subregions=thin_subregions,
        min_playable_per_subregion=min_playable_per_subregion,
        target_coverage=target_coverage,
    )

    return {
        "region": region.lower(),
        "region_name": country_name,
        "generated_at": _utc_now(),
        "target_coverage_pct": target_coverage,
        "min_playable_species": min_playable_species,
        "min_playable_per_subregion": min_playable_per_subregion,
        "ready": ready,
        "recommendation": recommendation,
        "parameters": params,
        "ebird": {
            "species_count": len(species_codes),
            "regular_species_count": regular_species_count,
            "subregion_count": len(enriched_subregions),
            "subregions": enriched_subregions,
            "subregion_error": subregion_error,
        },
        "regular": {
            "enabled": regular_filter_used,
            "days": params.get("regular_days", 0),
            "min_observations": params.get("regular_min_observations"),
            "min_days": params.get("regular_min_days"),
            "species_count": regular_species_count,
            "by_subregion": regular_by_subregion or {},
            "errors": regular_errors,
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
    ebird = report["ebird"]
    regular = report.get("regular", {})
    lines = [
        f"Region: {report['region']} ({report['region_name']})",
        f"eBird species: {ebird['species_count']}",
    ]
    if ebird.get("regular_species_count") is not None:
        lines.append(
            f"Regular pool: {ebird['regular_species_count']}"
            f" ({regular.get('days', 0)} days, min "
            f"{regular.get('min_observations')} observations on "
            f"{regular.get('min_days')} days)"
        )
    lines.extend(
        [
            f"Taxonomy matched: {report['taxonomy']['matched_species']}"
            f" (missing {len(report['taxonomy']['missing_species_codes'])})",
            f"Subregions: {ebird['subregion_count']}",
        ]
    )
    if audio is None:
        lines.append("Audio: skipped")
    else:
        lines.extend(
            [
                f"Audio coverage: {audio['species_with_audio']}/"
                f"{audio['species_checked']} ({audio['coverage_pct']}%)"
                f" target {report['target_coverage_pct']}%",
                f"Playable species target: {report['min_playable_species']}",
                f"Minimum playable per subregion: "
                f"{report.get('min_playable_per_subregion', 0)}",
                f"Clips selected: {audio['clips_selected']}",
                f"Quality: {audio['quality_counts']}",
                f"Licenses: {audio['license_counts']}",
                f"Missing audio: {len(audio['missing_audio'])}",
                f"Xeno-canto errors: {len(audio['errors'])}",
            ]
        )
    if regular.get("errors"):
        lines.append(f"eBird observation errors: {len(regular['errors'])}")
    thin = [
        sub["name"]
        for sub in ebird.get("subregions", [])
        if sub.get("playable_species_count") is not None
        and sub["playable_species_count"] < report.get("min_playable_per_subregion", 0)
    ]
    if thin:
        lines.append(f"Thin subregions: {len(thin)}")
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
        "--regular-days",
        type=int,
        default=14,
        help="Recent-observation window for the regular-species filter "
        "(default: 14; use 0 to audit every eBird species)",
    )
    parser.add_argument(
        "--regular-min-observations",
        type=int,
        default=5,
        help="Minimum valid observations for a regular species (default: 5)",
    )
    parser.add_argument(
        "--regular-min-days",
        type=int,
        default=5,
        help="Minimum distinct observation days for a regular species (default: 5)",
    )
    parser.add_argument(
        "--observation-delay",
        type=float,
        default=0.2,
        help="Delay between eBird observation requests in seconds (default: 0.2)",
    )
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
    parser.add_argument(
        "--min-playable-species",
        type=int,
        default=150,
        help="Minimum playable regular species (default: 150)",
    )
    parser.add_argument(
        "--min-playable-per-subregion",
        type=int,
        default=10,
        help="Minimum playable regular species in every subregion (default: 10)",
    )
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
        "regular_days": args.regular_days,
        "regular_min_observations": args.regular_min_observations,
        "regular_min_days": args.regular_min_days,
        "min_playable_per_subregion": args.min_playable_per_subregion,
    }

    regular_species_count = None
    regular_by_subregion = None
    regular_errors: list[dict[str, str]] = []

    try:
        species_codes = load_species_codes(region, args.species_file)
        subregions, subregion_error = load_subregions(
            region,
            args.subregions_file,
            args.skip_subregions,
        )
        selected_codes = species_codes
        if args.regular_days > 0:
            regular_codes, regular_by_subregion, regular_errors = load_regular_species(
                region,
                subregions,
                api_key=ebird_api_common.load_api_key(),
                days=args.regular_days,
                min_observations=args.regular_min_observations,
                min_days=args.regular_min_days,
                delay=args.observation_delay,
            )
            selected_codes = sorted(set(species_codes) & regular_codes)
            regular_species_count = len(selected_codes)

        taxonomy, taxonomy_missing, excluded_non_species = load_taxonomy(
            args.taxonomy,
            selected_codes,
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
        regular_species_count=regular_species_count,
        regular_by_subregion=regular_by_subregion,
        regular_errors=regular_errors,
        subregions=subregions,
        subregion_error=subregion_error,
        taxonomy=taxonomy,
        taxonomy_missing=taxonomy_missing,
        excluded_non_species=excluded_non_species,
        audio=audio,
        params=params,
        target_coverage=args.target_coverage,
        min_playable_species=args.min_playable_species,
        min_playable_per_subregion=args.min_playable_per_subregion,
        partial=bool(args.limit),
    )
    if args.output:
        _write_report(report, args.output)
    print(format_summary(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
