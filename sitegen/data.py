"""Load and validate the committed game data used to render pages."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import REQUIRED_DATA_FILES


class DataValidationError(ValueError):
    """Raised when a committed data file has an unusable shape."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise DataValidationError(message)


def load_json(path: Path) -> Any:
    """Load a JSON file with a helpful error message."""
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as error:
        raise DataValidationError(f"Missing data file: {path}") from error
    except json.JSONDecodeError as error:
        raise DataValidationError(f"Invalid JSON in {path}: {error}") from error


def _require_files(data_dir: Path) -> None:
    missing = [name for name in REQUIRED_DATA_FILES if not (data_dir / name).is_file()]
    _require(
        not missing,
        "Missing required data files: " + ", ".join(sorted(missing)),
    )


def _validate_region(region: Any, seen: set[str]) -> None:
    _require(isinstance(region, dict), "Each region must be an object")
    region_id = region.get("id")
    name = region.get("name")
    _require(
        isinstance(region_id, str) and bool(region_id),
        "Each region needs a non-empty id",
    )
    _require(
        isinstance(name, str) and bool(name),
        f"Region {region_id!r} needs a non-empty name",
    )
    _require(region_id not in seen, f"Duplicate region id: {region_id}")
    seen.add(region_id)


def load_regions(data_dir: Path) -> list[dict[str, Any]]:
    """Load and validate the region list used by navigation."""
    regions = load_json(Path(data_dir) / "regions.json")
    _require(
        isinstance(regions, list) and bool(regions),
        "regions.json must be a non-empty array",
    )

    seen: set[str] = set()
    for region in regions:
        _validate_region(region, seen)
    return regions


def _validate_bird(bird: Any, region_id: str) -> None:
    _require(
        isinstance(bird, dict), f"birds.json[{region_id!r}] entry must be an object"
    )
    _require(
        bool(bird.get("id")) and bool(bird.get("name")),
        f"birds.json[{region_id!r}] contains a bird without id/name",
    )


def _validate_bird_list(bird_list: Any, region_id: str) -> None:
    _require(
        isinstance(bird_list, list),
        f"birds.json[{region_id!r}] must be an array",
    )
    for bird in bird_list:
        _validate_bird(bird, region_id)


def _validate_birds(birds: Any) -> None:
    _require(
        isinstance(birds, dict) and bool(birds),
        "birds.json must be a non-empty object",
    )
    for region_id, bird_list in birds.items():
        _validate_bird_list(bird_list, region_id)


def _validate_daily_entry(entry: Any, region_ids: set[str]) -> None:
    _require(isinstance(entry, dict), "daily.json entries must be objects")
    _require(
        entry.get("region") in region_ids,
        f"daily.json has an unknown region: {entry.get('region')!r}",
    )
    _require(
        isinstance(entry.get("date"), str),
        "daily.json entries need a date",
    )
    _require(
        isinstance(entry.get("answerHash"), str),
        "daily.json entries need an answerHash",
    )


def _validate_daily(daily: Any, region_ids: set[str]) -> None:
    _require(isinstance(daily, list), "daily.json must be an array")
    for entry in daily:
        _validate_daily_entry(entry, region_ids)


def _validate_history_entry(entries: Any, region_id: str) -> None:
    _require(
        isinstance(entries, list),
        f"history.json[{region_id!r}] must be an array",
    )


def _validate_history(history: Any, region_ids: set[str]) -> None:
    _require(isinstance(history, dict), "history.json must be an object")
    for region_id, entries in history.items():
        _require(
            region_id in region_ids,
            f"history.json has an unknown region: {region_id!r}",
        )
        _validate_history_entry(entries, region_id)


def _validate_subregion_list(bird_list: Any, region_id: str, name: str) -> None:
    _require(
        isinstance(bird_list, list),
        f"daily-subregion-birds.json[{region_id!r}][{name!r}] must be an array",
    )


def _validate_subregion_group(by_subregion: Any, region_id: str) -> None:
    _require(
        isinstance(by_subregion, dict),
        f"daily-subregion-birds.json[{region_id!r}] must be an object",
    )
    for name, bird_list in by_subregion.items():
        _validate_subregion_list(bird_list, region_id, name)


def _validate_subregions(subregions: Any) -> None:
    _require(
        isinstance(subregions, dict),
        "daily-subregion-birds.json must be an object",
    )
    for region_id, by_subregion in subregions.items():
        _validate_subregion_group(by_subregion, region_id)


def validate_data(data_dir: Path) -> list[dict[str, Any]]:
    """Validate every data file required by the game.

    The browser is defensive too, but a broken pipeline should fail the build
    instead of publishing pages that cannot boot.
    """
    data_dir = Path(data_dir)
    _require_files(data_dir)
    regions = load_regions(data_dir)
    region_ids = {region["id"] for region in regions}

    _validate_birds(load_json(data_dir / "birds.json"))
    _validate_daily(load_json(data_dir / "daily.json"), region_ids)
    _validate_history(load_json(data_dir / "history.json"), region_ids)
    _validate_subregions(load_json(data_dir / "daily-subregion-birds.json"))

    return regions
