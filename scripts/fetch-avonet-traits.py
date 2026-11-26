#!/usr/bin/env python3
"""
Derive a per-species ecology cache from the AVONET 1.0 workbook.

AVONET (Tobias et al. 2022, Ecology Letters) ships measurements for ~11,000
birds plus six ecological variables. This script keeps only the fields the
fact generator uses, keyed by eBird species code so the rest of the pipeline
never has to deal with scientific-name joins at render time.

The workbook itself is 21 MB and is NOT committed. The derived cache is
(``scripts/data/species-ecology.json``), so normal runs and CI stay offline -
the same pattern as ``species-traits.json``. Rerun this only when the roster
gains species.

Usage:
    python3 scripts/fetch-avonet-traits.py --workbook /tmp/avonet.xlsx

    # Download from figshare first (it rate-limits, retry until 200):
    curl -sL -o /tmp/avonet.xlsx https://ndownloader.figshare.com/files/34480856

License: AVONET is CC BY 4.0. See THIRD_PARTY_NOTICES.md.
"""

import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

WORKBOOK_URL = "https://ndownloader.figshare.com/files/34480856"
CACHE_PATH = Path(__file__).parent / "data" / "species-ecology.json"
BIRDS_DIR = Path(__file__).parent.parent / "public" / "data" / "birds"

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
TEXT_TAG = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"

# Workbook sheet name -> the columns we keep from it.
EBIRD_SHEET = "AVONET2_eBird"
BIRDLIFE_SHEET = "AVONET1_BirdLife"
CROSSWALK_SHEET = "BirdLife-eBird crosswalk"

# AVONET column -> cache key. Continuous values stay in their published units.
EBIRD_FIELDS = {
    "Hand-Wing.Index": "hwi",
    "Wing.Length": "wing",
    "Tail.Length": "tail",
    "Beak.Length_Culmen": "beak",
    "Tarsus.Length": "tarsus",
    "Habitat": "habitat",
    "Migration": "migration",
    "Trophic.Niche": "niche",
    "Primary.Lifestyle": "lifestyle",
    "Inference": "inferred",
}


def sheet_paths(workbook):
    """Map sheet name -> zip member for every sheet in the workbook."""
    with zipfile.ZipFile(workbook) as archive:
        workbook_xml = archive.read("xl/workbook.xml").decode("utf-8")
        rels_xml = archive.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    sheets = re.findall(r'<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"', workbook_xml)
    rels = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels_xml))
    mapping = {}
    for name, rid in sheets:
        target = rels.get(rid, "")
        if not target:
            continue
        mapping[name] = "xl/" + target.lstrip("/").removeprefix("xl/")
    return mapping


def read_sheet(workbook, member):
    """Yield each data row of a sheet as a {column letter: value} dict.

    Values are read straight from the XML so the script needs no xlsx
    dependency; inline strings and the shared-string table are both handled.
    """
    with zipfile.ZipFile(workbook) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(t.text or "" for t in item.iter(TEXT_TAG)))
        root = ET.fromstring(archive.read(member))

    for row in root.find("m:sheetData", NS).findall("m:row", NS):
        cells = {}
        for cell in row.findall("m:c", NS):
            ref = cell.get("r") or ""
            match = re.match(r"[A-Z]+", ref)
            if not match:
                continue
            value = cell.find("m:v", NS)
            inline = cell.find("m:is", NS)
            if cell.get("t") == "s" and value is not None:
                text = shared[int(value.text)]
            elif inline is not None:
                text = "".join(t.text or "" for t in inline.iter(TEXT_TAG))
            else:
                text = value.text if value is not None else ""
            cells[match.group()] = text
        yield cells


def read_table(workbook, member):
    """Yield each data row of a sheet as a {header name: value} dict."""
    rows = read_sheet(workbook, member)
    try:
        header = next(rows)
    except StopIteration:
        return
    for row in rows:
        yield {header[col]: value for col, value in row.items() if col in header}


def to_float(text):
    """Parse a published decimal, treating AVONET's 'NA' as absent."""
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def load_roster(birds_dir):
    """Map (scientific name, eBird code) -> family for every shipped bird.

    Keyed by code as well as name because eight scientific names are shared by
    two codes (Tringa semipalmata ships as both willet1 and willet2 after a
    split). Keying on the name alone silently drops one of each pair - which
    is how Willet lost its ecology.
    """
    roster = {}
    for path in sorted(Path(birds_dir).glob("*.json")):
        for bird in json.loads(path.read_text(encoding="utf-8")):
            scientific = (bird.get("scientificName") or "").strip()
            code = bird.get("id")
            if not scientific or not code:
                continue
            # Family strings look like "Picidae (Woodpeckers)", with compound
            # names too ("Scolopacidae (Sandpipers and Allies)"); the leading
            # token is the scientific name in both forms.
            family = (bird.get("family") or "").split(" ")[0].strip()
            roster[(scientific, code)] = family
    return roster


def renamed_species(scientific, family, by_family_epithet):
    """The AVONET name for a species that was moved to another genus.

    Taxonomic revisions split and rename fast (Anarhynchus from Charadrius,
    Coloeus from Corvus), so roster names drift from AVONET's. Requiring both
    the family and the specific epithet catches real renames - and nothing
    else. Epithet alone is not enough: Willet (Tringa semipalmata) would match
    Magpie Goose (Anseranas semipalmata), a different family entirely.

    Returns:
        str | None: the single unambiguous AVONET name, else None.
    """
    parts = scientific.split()
    if not family or len(parts) < 2:
        return None
    candidates = [
        name
        for name in by_family_epithet.get((family, parts[1]), [])
        if name != scientific
    ]
    return candidates[0] if len(candidates) == 1 else None


def build_cache(workbook, birds_dir):
    """Join AVONET's eBird sheet to the roster, plus range size via crosswalk.

    Returns:
        dict: species code -> ecology record. Species AVONET does not cover
        are simply absent.
    """
    paths = sheet_paths(workbook)
    for name in (EBIRD_SHEET, BIRDLIFE_SHEET, CROSSWALK_SHEET):
        if name not in paths:
            raise SystemExit(f"Workbook is missing the '{name}' sheet")

    # Range size and breeding latitudes live on the BirdLife sheet; the
    # crosswalk maps the BirdLife species name to the eBird one.
    birdlife_range = {}
    for row in read_table(workbook, paths[BIRDLIFE_SHEET]):
        name = (row.get("Species1") or "").strip()
        if not name:
            continue
        entry = {}
        size = to_float(row.get("Range.Size"))
        if size is not None:
            entry["range"] = size
        # Latitudinal extent of the breeding and resident range.
        low = to_float(row.get("Min.Latitude"))
        high = to_float(row.get("Max.Latitude"))
        if low is not None:
            entry["minlat"] = low
        if high is not None:
            entry["maxlat"] = high
        if entry:
            birdlife_range[name] = entry

    # 517 eBird names map to several BirdLife taxa ("Many BL to 1eBird"),
    # usually because BirdLife splits a species. Taking the first row would
    # attribute one split's range to the whole species - which silently gave
    # the American robin a tropical 23-degree range. Keep every row and prefer
    # the identical name when there is one.
    crosswalk = {}
    for row in read_table(workbook, paths[CROSSWALK_SHEET]):
        ebird_name = (row.get("Species2") or "").strip()
        bl_name = (row.get("Species1") or "").strip()
        if ebird_name and bl_name:
            crosswalk.setdefault(ebird_name, []).append(bl_name)

    def birdlife_names(ebird_name):
        """BirdLife taxa for one eBird species, identical name first."""
        names = crosswalk.get(ebird_name) or []
        exact = [n for n in names if n == ebird_name]
        return exact or names

    roster = load_roster(birds_dir)
    cache = {}
    matched = 0
    ebird_rows = {}
    # (family, specific epithet) -> eBird names. Used only for the species
    # AVONET names under an older genus.
    by_family_epithet = {}
    for row in read_table(workbook, paths[EBIRD_SHEET]):
        scientific = (row.get("Species2") or "").strip()
        if not scientific:
            continue
        ebird_rows[scientific] = row
        family = (row.get("Family2") or "").strip()
        parts = scientific.split()
        if family and len(parts) >= 2:
            by_family_epithet.setdefault((family, parts[1]), []).append(scientific)

    for (scientific, code), family in sorted(roster.items()):
        row = ebird_rows.get(scientific)
        if row is None:
            renamed = renamed_species(scientific, family, by_family_epithet)
            row = ebird_rows.get(renamed) if renamed else None
        if row is None:
            continue
        matched += 1
        record = {}
        for column, key in EBIRD_FIELDS.items():
            raw = (row.get(column) or "").strip()
            if not raw or raw == "NA":
                continue
            if key == "inferred":
                # AVONET flags species whose measurements were borrowed from
                # a relative. Keep the flag so facts can avoid implying a
                # measurement that was never taken.
                record["inferred"] = raw.upper() == "YES"
                continue
            number = to_float(raw) if key in ("hwi", "wing", "tail", "beak", "tarsus") else None
            record[key] = number if number is not None else raw
        # Merge every matching BirdLife taxon: a split species gets the union
        # of its parts' ranges rather than one arbitrary part.
        geo = {}
        for bl_name in birdlife_names(scientific):
            part = birdlife_range.get(bl_name)
            if not part:
                continue
            if "range" in part:
                geo["range"] = geo.get("range", 0.0) + part["range"]
            if "minlat" in part:
                geo["minlat"] = min(geo.get("minlat", part["minlat"]), part["minlat"])
            if "maxlat" in part:
                geo["maxlat"] = max(geo.get("maxlat", part["maxlat"]), part["maxlat"])
        if geo:
            record.update(geo)
        if record:
            cache[code] = record

    return cache, matched, len(roster)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workbook",
        type=Path,
        required=True,
        help=f"AVONET 1.0 .xlsx (download: {WORKBOOK_URL})",
    )
    parser.add_argument("--birds-dir", type=Path, default=BIRDS_DIR)
    parser.add_argument("--out", type=Path, default=CACHE_PATH)
    args = parser.parse_args(argv)

    if not args.workbook.is_file():
        raise SystemExit(f"Workbook not found: {args.workbook}")

    cache, matched, roster_size = build_cache(args.workbook, args.birds_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(cache, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"AVONET rows matched: {matched} of {roster_size} roster species "
        f"({matched / roster_size * 100:.1f}%), cache entries: {len(cache)}"
    )
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
