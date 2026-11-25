"""Tests for the read-only region audit script."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

spec = importlib.util.spec_from_file_location(
    "region_audit", SCRIPTS / "region-audit.py"
)
region_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(region_audit)


TAXONOMY = [
    {
        "speciesCode": "amerob",
        "comName": "American Robin",
        "sciName": "Turdus migratorius",
        "category": "species",
    },
    {
        "speciesCode": "barswa",
        "comName": "Barn Swallow",
        "sciName": "Hirundo rustica",
        "category": "species",
    },
    {
        "speciesCode": "hybrid",
        "comName": "Hybrid Duck",
        "sciName": "Anas hybrid",
        "category": "hybrid",
    },
]

RECORDING = {
    "id": "694038",
    "rec": "A Recordist",
    "cnt": "Canada",
    "loc": "Ontario",
    "type": "song",
    "url": "https://xeno-canto.org/694038",
    "file": "https://xeno-canto.org/694038/download",
    "lic": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "q": "A",
    "length": "0:45",
    "date": "2024-05-01",
    "also": [],
}


@pytest.fixture
def offline_files(tmp_path: Path) -> tuple[Path, Path, Path]:
    taxonomy = tmp_path / "taxonomy.json"
    species = tmp_path / "species.json"
    subregions = tmp_path / "subregions.json"
    taxonomy.write_text(json.dumps(TAXONOMY), encoding="utf-8")
    species.write_text(json.dumps(["amerob", "barswa"]), encoding="utf-8")
    subregions.write_text(
        json.dumps([{"code": "CA-ON", "name": "Ontario"}]),
        encoding="utf-8",
    )
    return taxonomy, species, subregions


def run_audit(
    monkeypatch: pytest.MonkeyPatch,
    files: tuple[Path, Path, Path],
    report_path: Path,
    extra_args: list[str] | None = None,
) -> tuple[int, dict]:
    taxonomy, species, subregions = files
    monkeypatch.setattr(region_audit.XC, "load_api_key", lambda: "test-key")
    monkeypatch.setattr(
        region_audit.XC,
        "fetch_recordings",
        lambda *args, **kwargs: [RECORDING],
    )
    argv = [
        "--region",
        "CA",
        "--regular-days",
        "0",
        "--taxonomy",
        str(taxonomy),
        "--species-file",
        str(species),
        "--subregions-file",
        str(subregions),
        "--output",
        str(report_path),
        "--delay",
        "0",
        "--min-playable-species",
        "2",
        "--min-playable-per-subregion",
        "1",
        *(extra_args or []),
    ]
    code = region_audit.main(argv)
    return code, json.loads(report_path.read_text(encoding="utf-8"))


def test_audit_reports_coverage_and_quality(
    monkeypatch: pytest.MonkeyPatch, offline_files, tmp_path: Path, capsys
) -> None:
    code, report = run_audit(monkeypatch, offline_files, tmp_path / "report.json")

    assert code == 0
    assert report["region"] == "ca"
    assert report["ebird"]["species_count"] == 2
    assert report["ebird"]["subregion_count"] == 1
    assert report["taxonomy"]["matched_species"] == 2
    assert report["taxonomy"]["missing_species_codes"] == []
    assert report["audio"]["species_checked"] == 2
    assert report["audio"]["species_with_audio"] == 2
    assert report["audio"]["coverage_pct"] == 100.0
    assert report["audio"]["quality_counts"] == {"A": 2}
    assert report["audio"]["missing_audio"] == []
    assert report["ready"] is True
    assert "Ready: yes" in capsys.readouterr().out


def test_audit_reports_missing_audio(
    monkeypatch: pytest.MonkeyPatch, offline_files, tmp_path: Path
) -> None:
    taxonomy, species, subregions = offline_files
    species.write_text(json.dumps(["amerob", "barswa"]), encoding="utf-8")
    monkeypatch.setattr(region_audit.XC, "load_api_key", lambda: "test-key")
    monkeypatch.setattr(
        region_audit.XC,
        "fetch_recordings",
        lambda sci_name, **kwargs: [RECORDING] if "Turdus" in sci_name else [],
    )

    code = region_audit.main(
        [
            "--region",
            "CA",
            "--regular-days",
            "0",
            "--taxonomy",
            str(taxonomy),
            "--species-file",
            str(species),
            "--subregions-file",
            str(subregions),
            "--output",
            str(tmp_path / "report.json"),
            "--delay",
            "0",
        ]
    )
    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))

    assert code == 0
    assert report["audio"]["species_with_audio"] == 1
    assert report["audio"]["coverage_pct"] == 50.0
    assert report["audio"]["missing_audio"][0]["id"] == "barswa"
    assert report["ready"] is False


def test_audit_can_skip_audio(
    monkeypatch: pytest.MonkeyPatch, offline_files, tmp_path: Path, capsys
) -> None:
    called = False

    def fail_if_called(*args, **kwargs):
        nonlocal called
        called = True
        return []

    monkeypatch.setattr(region_audit.XC, "fetch_recordings", fail_if_called)
    code, report = run_audit(
        monkeypatch,
        offline_files,
        tmp_path / "report.json",
        extra_args=["--skip-audio"],
    )

    assert code == 0
    assert called is False
    assert report["audio"] is None
    assert report["ready"] is False
    assert "Audio: skipped" in capsys.readouterr().out


def test_non_species_entries_are_excluded_but_not_reported_missing(
    monkeypatch: pytest.MonkeyPatch, offline_files, tmp_path: Path
) -> None:
    taxonomy, _, subregions = offline_files
    species = offline_files[1]
    species.write_text(json.dumps(["amerob", "barswa", "hybrid"]), encoding="utf-8")
    monkeypatch.setattr(region_audit.XC, "load_api_key", lambda: "test-key")
    monkeypatch.setattr(
        region_audit.XC,
        "fetch_recordings",
        lambda *args, **kwargs: [RECORDING],
    )
    code = region_audit.main(
        [
            "--region",
            "CA",
            "--regular-days",
            "0",
            "--taxonomy",
            str(taxonomy),
            "--species-file",
            str(species),
            "--subregions-file",
            str(subregions),
            "--output",
            str(tmp_path / "report.json"),
            "--delay",
            "0",
        ]
    )
    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))

    assert code == 0
    assert report["taxonomy"]["excluded_non_species"] == 1
    assert report["taxonomy"]["missing_species_codes"] == []
    assert report["taxonomy"]["matched_species"] == 2


def test_missing_taxonomy_code_blocks_ready(
    monkeypatch: pytest.MonkeyPatch, offline_files, tmp_path: Path
) -> None:
    species = offline_files[1]
    species.write_text(
        json.dumps(["amerob", "barswa", "notintaxonomy"]), encoding="utf-8"
    )
    code, report = run_audit(monkeypatch, offline_files, tmp_path / "report.json")

    assert code == 0
    assert report["taxonomy"]["missing_species_codes"] == ["notintaxonomy"]
    assert "absent from the local taxonomy" in report["recommendation"]
    assert report["ready"] is False


def test_regular_filter_excludes_single_day_vagrant(
    monkeypatch: pytest.MonkeyPatch, offline_files, tmp_path: Path
) -> None:
    taxonomy_path, species_path, subregions_path = offline_files
    taxonomy = json.loads(taxonomy_path.read_text(encoding="utf-8"))
    taxonomy.append(
        {
            "speciesCode": "vagrant",
            "comName": "One-day Vagrant",
            "sciName": "Vagrans unicus",
            "category": "species",
        }
    )
    taxonomy_path.write_text(json.dumps(taxonomy), encoding="utf-8")
    species_path.write_text(
        json.dumps(["amerob", "barswa", "vagrant"]), encoding="utf-8"
    )

    calls = {"count": 0}

    def fake_get_json(*_args, **_kwargs):
        calls["count"] += 1
        observations = [
            {"speciesCode": "amerob", "obsValid": True},
            {"speciesCode": "barswa", "obsValid": True},
        ]
        if calls["count"] == 1:
            observations.extend(
                {"speciesCode": "vagrant", "obsValid": True} for _ in range(5)
            )
        return observations

    monkeypatch.setattr(
        region_audit.ebird_api_common, "load_api_key", lambda: "test-key"
    )
    monkeypatch.setattr(region_audit.ebird_api_common, "get_json", fake_get_json)
    monkeypatch.setattr(region_audit.XC, "load_api_key", lambda: "test-key")
    monkeypatch.setattr(
        region_audit.XC,
        "fetch_recordings",
        lambda *args, **kwargs: [RECORDING],
    )

    code = region_audit.main(
        [
            "--region",
            "CA",
            "--taxonomy",
            str(taxonomy_path),
            "--species-file",
            str(species_path),
            "--subregions-file",
            str(subregions_path),
            "--regular-days",
            "3",
            "--regular-min-observations",
            "3",
            "--regular-min-days",
            "3",
            "--observation-delay",
            "0",
            "--delay",
            "0",
            "--min-playable-species",
            "2",
            "--min-playable-per-subregion",
            "10",
            "--output",
            str(tmp_path / "report.json"),
        ]
    )
    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))

    assert code == 0
    assert report["ebird"]["species_count"] == 3
    assert report["ebird"]["regular_species_count"] == 2
    assert report["regular"]["by_subregion"]["Ontario"] == ["amerob", "barswa"]
    assert report["taxonomy"]["matched_species"] == 2
    assert report["audio"]["species_checked"] == 2
    assert report["audio"]["playable_ids"] == ["amerob", "barswa"]
    assert report["ebird"]["thin_subregions"] == ["Ontario"]
    assert report["ready"] is True


def test_regular_filter_observation_error_blocks_ready(
    monkeypatch: pytest.MonkeyPatch, offline_files, tmp_path: Path
) -> None:
    taxonomy_path, species_path, subregions_path = offline_files

    def fail_get_json(*args, **kwargs):
        raise region_audit.requests.RequestException("eBird unavailable")

    monkeypatch.setattr(
        region_audit.ebird_api_common, "load_api_key", lambda: "test-key"
    )
    monkeypatch.setattr(region_audit.ebird_api_common, "get_json", fail_get_json)

    code = region_audit.main(
        [
            "--region",
            "CA",
            "--taxonomy",
            str(taxonomy_path),
            "--species-file",
            str(species_path),
            "--subregions-file",
            str(subregions_path),
            "--regular-days",
            "3",
            "--observation-delay",
            "0",
            "--skip-audio",
            "--output",
            str(tmp_path / "report.json"),
        ]
    )
    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))

    assert code == 0
    assert report["regular"]["species_count"] == 0
    assert len(report["regular"]["errors"]) == 1
    assert "observation fetch failed" in report["recommendation"]
    assert report["ready"] is False


def test_format_summary_handles_skipped_audio() -> None:
    report = {
        "region": "ca",
        "region_name": "Canada",
        "ebird": {"species_count": 1, "subregion_count": 0},
        "taxonomy": {"matched_species": 1, "missing_species_codes": []},
        "audio": None,
        "target_coverage_pct": 80.0,
        "ready": False,
        "recommendation": "Audio audit skipped; run without --skip-audio first.",
    }
    summary = region_audit.format_summary(report)
    assert "Audio: skipped" in summary
    assert "Ready: no" in summary
