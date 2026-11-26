"""Tests for committed game data validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from sitegen.data import DataValidationError, load_regions, validate_data

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"


def test_real_data_is_valid() -> None:
    regions = validate_data(DATA)
    assert {region["id"] for region in regions} == {
        "us",
        "us-lower48",
        "gb",
        "ca",
        "au",
        "ie",
        "za",
        "cr",
        "fr",
        "jp",
    }


def test_missing_required_file_fails(tmp_path: Path) -> None:
    for name in (
        "regions.json",
        "daily.json",
        "history.json",
        "daily-subregion-birds.json",
    ):
        (tmp_path / name).write_text("{}", encoding="utf-8")
    (tmp_path / "regions.json").write_text(
        json.dumps([{"id": "us", "name": "United States"}]),
        encoding="utf-8",
    )
    (tmp_path / "birds").mkdir()
    (tmp_path / "birds" / "us.json").write_text(
        json.dumps([{"id": "amerob", "name": "American Robin"}]),
        encoding="utf-8",
    )
    (tmp_path / "daily.json").write_text("[]", encoding="utf-8")
    (tmp_path / "history.json").write_text("{}", encoding="utf-8")
    (tmp_path / "daily-subregion-birds.json").write_text("{}", encoding="utf-8")

    (tmp_path / "daily.json").unlink()
    with pytest.raises(DataValidationError, match="Missing required data files"):
        validate_data(tmp_path)


def test_unknown_daily_region_fails(tmp_path: Path) -> None:
    validate_data(DATA)  # sanity check the fixtures below start from real files
    for name in (
        "regions.json",
        "history.json",
        "daily-subregion-birds.json",
    ):
        (tmp_path / name).write_text("{}", encoding="utf-8")
    (tmp_path / "regions.json").write_text(
        json.dumps([{"id": "us", "name": "United States"}]),
        encoding="utf-8",
    )
    (tmp_path / "birds").mkdir()
    (tmp_path / "birds" / "us.json").write_text(
        json.dumps([{"id": "amerob", "name": "American Robin"}]),
        encoding="utf-8",
    )
    (tmp_path / "history.json").write_text("{}", encoding="utf-8")
    (tmp_path / "daily-subregion-birds.json").write_text("{}", encoding="utf-8")
    (tmp_path / "daily.json").write_text(
        json.dumps(
            [
                {
                    "date": "2026-11-24",
                    "region": "not-a-region",
                    "answerHash": "abcdef12",
                }
            ]
        ),
        encoding="utf-8",
    )
    with pytest.raises(DataValidationError, match="unknown region"):
        validate_data(tmp_path)


def test_duplicate_region_ids_fail(tmp_path: Path) -> None:
    path = tmp_path / "regions.json"
    path.write_text(
        json.dumps(
            [
                {"id": "us", "name": "United States"},
                {"id": "us", "name": "Duplicate"},
            ]
        ),
        encoding="utf-8",
    )
    with pytest.raises(DataValidationError, match="Duplicate region"):
        load_regions(tmp_path)


def test_missing_bird_shard_fails(tmp_path: Path) -> None:
    for name in (
        "regions.json",
        "daily.json",
        "history.json",
        "daily-subregion-birds.json",
    ):
        (tmp_path / name).write_text(
            "[]" if name == "daily.json" else "{}", encoding="utf-8"
        )
    (tmp_path / "regions.json").write_text(
        json.dumps(
            [
                {"id": "us", "name": "United States"},
                {"id": "ca", "name": "Canada"},
            ]
        ),
        encoding="utf-8",
    )
    (tmp_path / "daily.json").write_text("[]", encoding="utf-8")
    (tmp_path / "history.json").write_text("{}", encoding="utf-8")
    (tmp_path / "daily-subregion-birds.json").write_text("{}", encoding="utf-8")
    (tmp_path / "birds").mkdir()
    (tmp_path / "birds" / "us.json").write_text(
        json.dumps([{"id": "amerob", "name": "American Robin"}]), encoding="utf-8"
    )

    with pytest.raises(DataValidationError, match="Missing bird shard"):
        validate_data(tmp_path)
