"""Data helpers for browser tests (kept separate from pytest fixtures)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "public" / "data"


def load_json(name: str) -> object:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def hash_string(value: str) -> str:
    result = 0
    if not value:
        return "00000000"
    for character in value:
        result = ((result << 5) - result) + ord(character)
        result &= 0xFFFFFFFF
    return f"{result:08x}"


def hash_bird_id(bird_id: str) -> str:
    return hash_string(f"{bird_id}-birdle-salt-2025")


def today_iso() -> str:
    # The test browser is pinned to UTC in conftest.py.
    return datetime.now(timezone.utc).date().isoformat()


def _latest_daily_entry(daily: object, region: str, day: str) -> dict:
    entries = [
        entry for entry in daily if entry["region"] == region and entry["date"] <= day
    ]
    if not entries:
        raise AssertionError(f"No daily entry for {region} on/before {day}")
    return sorted(entries, key=lambda item: item["date"], reverse=True)[0]


def _lookup_region(region: str, regions: list[dict]) -> str:
    region_record = next((entry for entry in regions if entry["id"] == region), {})
    return region_record.get("parentRegion", region)


def _find_answer(bird_list: list[dict], answer_hash: str) -> dict | None:
    return next(
        (
            candidate
            for candidate in bird_list
            if hash_bird_id(candidate["id"]) == answer_hash
        ),
        None,
    )


def load_region_birds(region: str) -> list[dict]:
    regions = load_json("regions.json")
    return load_json(f"birds/{_lookup_region(region, regions)}.json")


def answer_for(region: str, day: str | None = None) -> tuple[dict, dict]:
    """Return the latest daily bird and entry for a region on/before *day*."""
    day = day or today_iso()
    daily = load_json("daily.json")
    entry = _latest_daily_entry(daily, region, day)
    birds = load_region_birds(region)
    bird = _find_answer(birds, entry["answerHash"])
    if not bird:
        raise AssertionError(f"Daily answer for {region} is not in its bird shard")
    return bird, entry


def other_bird(bird_id: str, region: str = "us") -> dict:
    birds = load_region_birds(region)
    result = next((bird for bird in birds if bird["id"] != bird_id), None)
    if not result:
        raise AssertionError(f"No alternative bird found in {region}")
    return result


def finish_normal_round(page) -> None:
    """Guess until the round ends, whatever the answer turns out to be.

    The daily answer is random per run, so a test cannot know the correct
    option; four guesses exhaust a normal round either way.
    """
    page.wait_for_selector(".answer-option")
    for _ in range(4):
        if page.locator("[data-completion]:not([hidden])").count():
            break
        page.locator(".answer-option").first.click()
        page.wait_for_timeout(100)
    page.wait_for_selector("[data-completion]:not([hidden])")
