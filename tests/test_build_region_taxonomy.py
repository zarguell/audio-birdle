"""Tests for the region taxonomy snapshot builder."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

spec = importlib.util.spec_from_file_location(
    "build_region_taxonomy", SCRIPTS / "build-region-taxonomy.py"
)
build_region_taxonomy = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = build_region_taxonomy
spec.loader.exec_module(build_region_taxonomy)


TAXONOMY = [
    {
        "speciesCode": "amerob",
        "comName": "American Robin",
        "sciName": "Turdus migratorius",
        "category": "species",
        "order": "Passeriformes",
    },
    {
        "speciesCode": "hybrid",
        "comName": "Hybrid Duck",
        "sciName": "Anas hybrid",
        "category": "hybrid",
        "order": "Anseriformes",
    },
    {
        "speciesCode": "eamwre1",
        "comName": "Eastern Marsh Wren",
        "sciName": "Cistothorus palustris",
        "category": "species",
        "order": "Passeriformes",
    },
]


def test_load_species_codes_accepts_mapping(tmp_path):
    path = tmp_path / "pool.json"
    path.write_text(json.dumps({"Canada": ["amerob", "eamwre1"]}), encoding="utf-8")
    assert build_region_taxonomy.load_species_codes(path) == {
        "amerob",
        "eamwre1",
    }


def test_filter_taxonomy_excludes_non_species_and_reports_missing():
    filtered, missing, excluded = build_region_taxonomy.filter_taxonomy(
        TAXONOMY, {"amerob", "hybrid", "missing"}
    )

    assert [entry["speciesCode"] for entry in filtered] == ["amerob"]
    assert missing == ["missing"]
    assert excluded == 1


def test_main_writes_sorted_species_snapshot(tmp_path, monkeypatch):
    species = tmp_path / "pool.json"
    taxonomy = tmp_path / "taxonomy.json"
    output = tmp_path / "ca-taxonomy.json"
    species.write_text(json.dumps({"Canada": ["eamwre1", "amerob"]}), encoding="utf-8")
    taxonomy.write_text(json.dumps(TAXONOMY), encoding="utf-8")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build-region-taxonomy.py",
            "--region",
            "CA",
            "--species-file",
            str(species),
            "--taxonomy-file",
            str(taxonomy),
            "--output",
            str(output),
        ],
    )

    assert build_region_taxonomy.main() == 0
    written = json.loads(output.read_text(encoding="utf-8"))
    assert [entry["speciesCode"] for entry in written] == ["amerob", "eamwre1"]


def test_main_fails_when_taxonomy_is_incomplete(tmp_path, monkeypatch, capsys):
    species = tmp_path / "pool.json"
    taxonomy = tmp_path / "taxonomy.json"
    output = tmp_path / "ca-taxonomy.json"
    species.write_text(json.dumps(["missing"]), encoding="utf-8")
    taxonomy.write_text(json.dumps(TAXONOMY), encoding="utf-8")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build-region-taxonomy.py",
            "--region",
            "CA",
            "--species-file",
            str(species),
            "--taxonomy-file",
            str(taxonomy),
            "--output",
            str(output),
        ],
    )

    assert build_region_taxonomy.main() == 2
    assert "Missing from taxonomy" in capsys.readouterr().out
    assert not output.exists()
