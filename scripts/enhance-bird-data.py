#!/usr/bin/env python3
"""
Enhance existing per-region bird shards (or a legacy aggregate) in place.

Unlike the full regeneration path (ebird-taxonomy.py -> ... ->
game-data-generator.py), this tool edits the *shipped* bird shards so
existing species and their proven-live Macaulay Library clips are never
dropped. Three enhancements:

1. Normalize every ``audioUrl`` entry to the ``{url, attribution}``
   object format (the frontend's getAudioSrc/sanitizeBird handle both
   shapes, and BirdCompletionCard renders attribution from objects).
   Legacy Cornell CDN strings get ``source: "macaulay-library"``.
2. Backfill ``learnMoreUrl`` with the public eBird species page
   (https://ebird.org/species/<id>) when empty - no network needed.
3. Merge clips fetched by xc-audio-fetch.py (Xeno-canto API v3) into
   each species, newest-last, deduplicated by URL and capped per
   species. XC clips carry real attribution (recordist, license,
   quality, ...). Species with few clips gain variety first.
4. Generate each species' ``facts`` from real traits: body mass and IUCN
   Red List status (``scripts/data/species-traits.json``, from Everybird's
   species dataset), plus subregion prevalence when ``--subregions`` is
   given. Generated text is replaced; a hand-written fact is left alone.

The daily-challenge system is untouched: daily.json answer hashes are
based on species codes, no species are removed, and clip ordering keeps
existing ML clips at their current indices.

Usage:
    # Offline enhancements only (no API key needed):
    python3 enhance-bird-data.py ../public/data/birds

    # After fetching Xeno-canto clips (see xc-audio-fetch.py):
    python3 enhance-bird-data.py ../public/data/birds \\
        --xc-urls data/regions/us-taxonomy-urls.json

    # Preview changes without writing:
    python3 enhance-bird-data.py ../public/data/birds --dry-run
"""

import argparse
import importlib.util
import json
import re
import sys
from collections import Counter
from pathlib import Path

# Reuse the canonical URL-record -> {url, attribution} mapping from
# game-data-generator.py (hyphenated filename, so load via importlib -
# same pattern the test suite uses).
_GEN_PATH = Path(__file__).parent / "game-data-generator.py"
_gen_spec = importlib.util.spec_from_file_location("game_data_generator", _GEN_PATH)
game_data_generator = importlib.util.module_from_spec(_gen_spec)
_gen_spec.loader.exec_module(game_data_generator)

ML_CDN_HOST = "cdn.download.ams.birds.cornell.edu"

# Per-species traits (body mass, IUCN status) keyed by eBird species code.
# Sourced from Everybird's public species dataset, which in turn cites AVONET
# and BIRDBASE for mass (both CC BY 4.0). Cached next to the script so a rerun
# does not re-download and CI never needs the network.
TRAITS_URL = (
    "https://raw.githubusercontent.com/yusuftaleb/everybird/main/"
    "public/data/species.v1.json"
)
TRAITS_CACHE = Path(__file__).parent / "data" / "species-traits.json"

# IUCN Red List categories, in the order the site presents them.
IUCN_LABELS = {
    "LC": "Least Concern",
    "NT": "Near Threatened",
    "VU": "Vulnerable",
    "EN": "Endangered",
    "CR": "Critically Endangered",
    "EW": "Extinct in the Wild",
    "EX": "Extinct",
    "DD": "Data Deficient",
}
EBIRD_SPECIES_URL = "https://ebird.org/species/{code}"
SUBREGION_LABEL = "US states/provinces"

# Family strings look like "Turdidae (Thrushes)" or just "Turdidae".
FAMILY_RE = re.compile(r"^\s*([A-Za-z][A-Za-z-]*)(?:\s*\(([^)]+)\))?\s*$")


def is_https_url(url):
    """Check that a URL is an absolute https URL (mirror of frontend rule)."""
    return isinstance(url, str) and url.startswith("https://")


def clip_url(entry):
    """Extract the playable URL from an audioUrl entry (string or object)."""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return entry.get("url", "")
    return ""


def normalize_audio_urls(bird):
    """Convert audioUrl entries to {url, attribution} objects in place.

    Legacy Macaulay CDN strings get a minimal provenance attribution.

    Returns:
        int: number of entries converted from plain strings.
    """
    audio = bird.get("audioUrl")
    if not isinstance(audio, list):
        return 0

    converted = 0
    normalized = []
    for entry in audio:
        if isinstance(entry, str) and is_https_url(entry):
            attribution = {}
            if ML_CDN_HOST in entry:
                attribution["source"] = "macaulay-library"
            normalized.append({"url": entry, "attribution": attribution})
            converted += 1
        elif isinstance(entry, dict):
            normalized.append(entry)
        # Non-string/non-dict or non-https entries are dropped, matching
        # the frontend sanitizer.
    bird["audioUrl"] = normalized
    return converted


def backfill_learn_more(bird):
    """Set learnMoreUrl to the eBird species page when empty.

    Returns:
        bool: True when the field was added.
    """
    code = bird.get("id")
    if not code or bird.get("learnMoreUrl"):
        return False
    bird["learnMoreUrl"] = EBIRD_SPECIES_URL.format(code=code)
    return True


def quality_rank(quality):
    """Map an XC quality letter to a sortable rank (A best)."""
    return {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}.get(str(quality).strip().upper(), 0)


def parse_family(family):
    """Split a family string into (scientific, common) parts.

    "Turdidae (Thrushes)" -> ("Turdidae", "Thrushes"); a missing or
    unparseable family yields (None, None).
    """
    match = FAMILY_RE.match(family or "")
    if not match:
        return None, None
    return match.group(1), match.group(2)


def singularize_family_name(name):
    """Best-effort singular form of a simple family common name.

    "Thrushes" -> "thrush", "Flycatchers" -> "flycatcher". Compound
    names (commas / "and", e.g. "Ducks, Geese, and Waterfowl") cannot be
    singularized safely and return None so callers use the fallback form.
    """
    lowered = name.strip().lower()
    if not lowered or "," in lowered or " and " in lowered:
        return None
    if lowered.endswith("ss") or not lowered.endswith("s"):
        return None if lowered.endswith("ss") else lowered
    # -es after sibilants ("Thrushes") or vowel+es gets the -es dropped;
    # everything else ("Flycatchers", "Owls", "Vireos") just loses the s.
    if lowered.endswith("es") and len(lowered) > 4:
        stem = lowered[:-2]
        if lowered[-4:-2] in ("sh", "ch") or lowered[-3] in "sxz":
            return stem
    return lowered[:-1]


def build_fact(
    bird,
    prevalence=None,
    total_subregions=None,
    subregion_label=SUBREGION_LABEL,
):
    """Build a one-sentence fact for a bird from local data.

    Combines subregion prevalence ("Recorded in 31 of 51 US
    states/provinces") with family context ("a member of the thrush
    family (Turdidae)") when each source is available.

    Returns:
        str: The fact sentence, or "" when neither part is available.
    """
    sci, com = parse_family(bird.get("family"))

    parts = []
    if prevalence and total_subregions:
        parts.append(
            f"Recorded in {prevalence} of {total_subregions} {subregion_label}"
        )

    if sci and com:
        singular = singularize_family_name(com)
        if singular:
            parts.append(f"a member of the {singular} family ({sci})")
        else:
            parts.append(f"a member of the family {sci} ({com})")
    elif sci:
        parts.append(f"a member of the family {sci}")

    if not parts:
        return ""
    if len(parts) == 1:
        # Family-only reads better capitalized as a sentence start.
        return parts[0][0].upper() + parts[0][1:] + "."
    return " \u2014 ".join(parts) + "."


def load_traits(path=TRAITS_CACHE, url=TRAITS_URL):
    """Load per-species traits keyed by eBird species code.

    The cache is committed, so normal runs never touch the network. Pass
    ``url=None`` to require the cache, or ``path=None`` to always fetch.

    Returns:
        dict: code -> {"mass": float, "iucn": str}, tolerating missing rows.
    """
    if path is not None and Path(path).exists():
        try:
            with open(path, "r", encoding="utf-8") as file:
                return json.load(file)
        except (OSError, json.JSONDecodeError):
            pass
    if not url:
        return {}
    import urllib.request

    request = urllib.request.Request(
        url, headers={"User-Agent": "audio-birdle data pipeline"}
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.load(response)
    traits = {}
    for row in payload.get("species", []):
        code = row.get("code")
        if not code:
            continue
        entry = {}
        grams = row.get("g")
        if isinstance(grams, (int, float)) and not isinstance(grams, bool) and grams > 0:
            entry["mass"] = float(grams)
        status = row.get("iu")
        if isinstance(status, str) and status in IUCN_LABELS:
            entry["iucn"] = status
        if entry:
            traits[code] = entry
    if path is not None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as file:
            json.dump(traits, file, separators=(",", ":"), sort_keys=True)
    return traits


def format_mass(grams):
    """Human mass: grams under 1 kg, kilograms above, both to one decimal."""
    if grams >= 1000:
        return f"{grams / 1000:.1f} kg"
    if grams >= 10:
        return f"{grams:.0f} g"
    return f"{grams:.1f} g"


def mass_percentile(grams, all_masses):
    """Share of species this bird outweighs, 0-100."""
    if not all_masses:
        return None
    below = sum(1 for other in all_masses if other < grams)
    return below / len(all_masses) * 100


def extreme_label(percentile):
    """Phrase a percentile as a superlative, or None when it is unremarkable.

    Only the tails get a superlative: calling a median-weight bird "heavier
    than 51%" is true but is not a fun fact, and 3,500 of those would read as
    padding. The wording avoids claiming a rank we do not compute.
    """
    if percentile is None:
        return None
    if percentile >= 99:
        return "one of the heaviest birds here"
    if percentile >= 95:
        return "heavier than 95% of the birds here"
    if percentile <= 1:
        return "one of the lightest birds here"
    if percentile <= 5:
        return "lighter than 95% of the birds here"
    return None


def build_trait_fact(bird, traits, all_masses):
    """A fact built from real per-species traits, or "" when none apply.

    Prefers a superlative mass claim, then IUCN status, then a plain weight
    with its percentile. Every branch is arithmetic over the cited dataset, so
    the sentence is checkable rather than remembered.
    """
    entry = traits.get(bird.get("id")) if bird.get("id") else None
    if not entry:
        return ""
    name = bird.get("name") or "This bird"

    grams = entry.get("mass")
    status = entry.get("iucn")
    label = IUCN_LABELS.get(status) if status and status != "LC" else None

    # Conservation status leads when it is not Least Concern: it is the more
    # important sentence, and a threatened swan would otherwise be described
    # only as heavy.
    if label:
        sentence = f"{name} is listed as {label} on the IUCN Red List"
        if grams:
            sentence += f" and weighs about {format_mass(grams)}"
        return sentence + "."

    if grams:
        percentile = mass_percentile(grams, all_masses)
        extreme = extreme_label(percentile)
        if extreme:
            prefix = "At just" if percentile is not None and percentile <= 5 else "At"
            return f"{prefix} {format_mass(grams)}, {name} is {extreme}."
        return f"{name} weighs about {format_mass(grams)}."
    return ""


def is_generated_fact(fact):
    """True when a fact came from this script, so it may be regenerated.

    Two shapes exist upstream: the taxonomy template ("A member of the thrush
    family (Turdidae).") and the prevalence variant ("Recorded in 25 of 51 US
    states/provinces - a member of ..."). Anything else is treated as
    hand-written and never overwritten.
    """
    if not isinstance(fact, str):
        return False
    text = fact.strip()
    if not text:
        return True
    if text.startswith("A member of the ") and text.endswith(")."):
        return True
    if text.startswith("Recorded in ") and "a member of the " in text:
        return True
    return False


def backfill_facts(
    bird,
    prevalence,
    total_subregions,
    subregion_label=SUBREGION_LABEL,
    traits=None,
    all_masses=None,
):
    """Set bird.facts from real traits, else local prevalence + taxonomy.

    Traits come first: body mass and IUCN status are per-species and cited,
    where the taxonomy template can only say "a member of the thrush family"
    and is shared by every thrush on the roster.

    Returns:
        bool: True when a fact was added.
    """
    if not bird.get("id"):
        return False
    # Every shipped bird already carries a generated template fact, so "empty"
    # is not the condition: a generated one must be replaced by a trait fact.
    # Anything else is treated as hand-written and left alone.
    current = bird.get("facts") or ""
    if current and not is_generated_fact(current):
        return False
    fact = build_trait_fact(bird, traits or {}, all_masses or [])
    if not fact:
        fact = build_fact(bird, prevalence, total_subregions, subregion_label)
    if not fact:
        return False
    bird["facts"] = fact
    return True


def compute_prevalence(subregions_by_region):
    """Count, per species, how many subregions report it.

    Args:
        subregions_by_region: e.g. daily-subregion-birds.json's
            {"us": {"Alabama": [{"id": ...}, ...], ...}} mapping.

    Returns:
        tuple: (prevalence_by_id, total_subregions)
    """
    prevalence = Counter()
    total = 0
    for subregion, birds in subregions_by_region.items():
        total += 1
        for bird in birds or []:
            bird_id = bird.get("id")
            if bird_id:
                prevalence[bird_id] += 1
    return prevalence, total


def merge_xc_clips(bird, xc_entries, max_clips=10):
    """Append Xeno-canto clips to a bird's audioUrl list in place.

    Existing clips keep their positions (stable gameplay); new clips are
    appended best-quality-first, deduplicated by URL, and the total is
    capped at ``max_clips``.

    Args:
        bird: Bird record (audioUrl already normalized).
        xc_entries: List of {url, attribution} objects for this species.
        max_clips: Maximum total clips per species.

    Returns:
        int: number of clips added.
    """
    audio = bird.get("audioUrl")
    if not isinstance(audio, list) or not xc_entries:
        return 0

    existing = {clip_url(entry) for entry in audio}
    candidates = sorted(
        (e for e in xc_entries if e.get("url") and e["url"] not in existing),
        key=lambda e: -quality_rank(e.get("attribution", {}).get("quality")),
    )

    added = 0
    for entry in candidates:
        if len(audio) >= max_clips:
            break
        audio.append(entry)
        added += 1
    return added


def load_xc_entries(xc_urls_path):
    """Load xc-audio-fetch.py output grouped by species code.

    Returns:
        dict: species code -> list of {url, attribution} objects.
    """
    with open(xc_urls_path, "r", encoding="utf-8") as file:
        records = json.load(file)

    grouped = {}
    for record in records:
        code = record.get("code", "")
        if code and record.get("audio Url"):
            grouped.setdefault(code, []).append(
                game_data_generator.build_audio_entry(record)
            )
    return grouped


def enhance_region(
    birds,
    xc_by_code=None,
    max_clips=10,
    learn_more=True,
    prevalence=None,
    total_subregions=0,
    facts=True,
    subregion_label=SUBREGION_LABEL,
    traits=None,
    all_masses=None,
):
    """Apply all enhancements to one region's bird list in place.

    Args:
        prevalence: Optional Counter of species -> subregion count.
        total_subregions: Total subregions behind ``prevalence``.
        facts: Whether to fill ``facts`` fields.
        traits: Optional per-species traits keyed by eBird code.
        all_masses: Masses across every species, for percentile framing.

    Returns:
        dict: summary statistics.
    """
    xc_by_code = xc_by_code or {}
    prevalence = prevalence or Counter()
    stats = Counter()
    clip_counts_before = [len(b.get("audioUrl") or []) for b in birds]

    for bird in birds:
        stats["clips_normalized"] += normalize_audio_urls(bird)
        if learn_more and backfill_learn_more(bird):
            stats["learn_more_added"] += 1
        if facts and backfill_facts(
            bird,
            prevalence.get(bird.get("id")),
            total_subregions,
            subregion_label,
            traits=traits,
            all_masses=all_masses,
        ):
            stats["facts_added"] += 1

        entries = xc_by_code.get(bird.get("id"), [])
        if entries:
            added = merge_xc_clips(bird, entries, max_clips=max_clips)
            if added:
                stats["species_with_xc_added"] += 1
                stats["xc_clips_added"] += added

    stats["species_single_clip_before"] = sum(1 for n in clip_counts_before if n <= 1)
    stats["species_single_clip_after"] = sum(
        1 for b in birds if len(b.get("audioUrl") or []) <= 1
    )
    return dict(stats)


def main():
    parser = argparse.ArgumentParser(
        description="Enhance existing bird shards with attribution, "
        "learn-more links and (optionally) Xeno-canto clips."
    )
    parser.add_argument(
        "birds_json",
        type=Path,
        help="Path to the birds/ shard directory (preferred) or a legacy "
        "aggregate birds.json",
    )
    parser.add_argument(
        "--xc-urls",
        type=Path,
        default=None,
        help="Optional xc-audio-fetch.py output file to merge clips from",
    )
    parser.add_argument(
        "--region",
        type=str,
        default=None,
        help="Only enhance this region key (default: all regions)",
    )
    parser.add_argument(
        "--max-clips",
        type=int,
        default=10,
        help="Maximum total clips per species (default: 10)",
    )
    parser.add_argument(
        "--no-learn-more",
        action="store_true",
        help="Skip learnMoreUrl backfill",
    )
    parser.add_argument(
        "--subregions",
        type=Path,
        default=None,
        help="daily-subregion-birds.json path; enables fact generation "
        "(prevalence + family context)",
    )
    parser.add_argument(
        "--subregion-label",
        default=SUBREGION_LABEL,
        help=f"Label used in prevalence facts (default: {SUBREGION_LABEL})",
    )
    parser.add_argument(
        "--no-facts",
        action="store_true",
        help="Skip fact backfill (facts are generated when --subregions is provided)",
    )
    parser.add_argument(
        "--no-traits",
        action="store_true",
        help="Skip per-species trait facts (mass, IUCN) and use taxonomy only",
    )
    parser.add_argument(
        "--refresh-traits",
        action="store_true",
        help="Re-download the trait cache before generating facts",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the summary without writing the file",
    )
    args = parser.parse_args()

    input_path = Path(args.birds_json)
    shard_mode = input_path.is_dir()
    try:
        if shard_mode:
            data = {}
            for path in sorted(input_path.glob("*.json")):
                data[path.stem] = json.loads(path.read_text(encoding="utf-8"))
        else:
            with input_path.open(encoding="utf-8") as file:
                data = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        print(f"❌ Error loading {input_path}: {error}")
        sys.exit(1)

    regions = [args.region] if args.region else list(data.keys())
    xc_by_code = load_xc_entries(args.xc_urls) if args.xc_urls else {}

    prevalence, total_subregions = Counter(), 0
    if args.subregions:
        try:
            with open(args.subregions, "r", encoding="utf-8") as file:
                subregions_data = json.load(file)
            # Facts describe species, which are region-shared; use the
            # requested region when present, otherwise the first (parent)
            # region's subregion lists.
            source_region = (
                args.region
                if args.region in subregions_data
                else next(iter(subregions_data))
            )
            parent_lists = subregions_data[source_region]
            prevalence, total_subregions = compute_prevalence(parent_lists)
            print(
                f"📊 Fact source: {len(prevalence)} species across "
                f"{total_subregions} subregions in {args.subregions.name}"
            )
        except (OSError, json.JSONDecodeError, StopIteration) as error:
            print(f"❌ Error loading {args.subregions}: {error}")
            sys.exit(1)
    traits, all_masses = {}, []
    if not args.no_traits:
        try:
            traits = load_traits(url=TRAITS_URL if args.refresh_traits else None)
        except Exception as error:  # noqa: BLE001 - network/cache both degrade
            print(f"⚠️  Traits unavailable, using taxonomy facts: {error}")
            traits = {}
        # Percentiles must compare like with like, so the reference set is
        # every species this script could ship, not just one region's roster.
        all_masses = sorted(
            entry["mass"] for entry in traits.values() if entry.get("mass")
        )
        print(f"🧬 Traits: {len(traits)} species ({len(all_masses)} with mass)")

    matched_codes = set()

    total_stats = Counter()
    for region in regions:
        birds = data.get(region)
        if not isinstance(birds, list):
            print(f"⚠️  Skipping region '{region}': no bird list found")
            continue
        stats = enhance_region(
            birds,
            xc_by_code=xc_by_code,
            max_clips=args.max_clips,
            learn_more=not args.no_learn_more,
            prevalence=prevalence,
            total_subregions=total_subregions,
            facts=not args.no_facts,
            subregion_label=args.subregion_label,
            traits=traits,
            all_masses=all_masses,
        )
        matched_codes.update(b.get("id") for b in birds if b.get("id") in xc_by_code)
        print(f"🌍 Region '{region}':")
        for key in sorted(stats):
            print(f"   {key}: {stats[key]}")
        total_stats.update(stats)

    unmatched = set(xc_by_code) - matched_codes
    if xc_by_code:
        print(
            f"ℹ️  XC species matched: {len(matched_codes)}, "
            f"unmatched (not in birds.json): {len(unmatched)}"
        )

    if args.dry_run:
        print("🔍 Dry run: no changes written")
        return

    if shard_mode:
        for region in regions:
            shard_path = input_path / f"{region}.json"
            shard_path.write_text(
                json.dumps(data[region], indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
        print(f"✅ Enhanced shards written to {input_path}")
    else:
        with input_path.open("w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
        print(f"✅ Enhanced data written to {input_path}")


if __name__ == "__main__":
    main()
