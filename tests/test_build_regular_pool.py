"""Tests for the year-round regular-species pool builder."""

from __future__ import annotations

import importlib.util
import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

spec = importlib.util.spec_from_file_location(
    "build_regular_pool", SCRIPTS / "build-regular-pool.py"
)
build_regular_pool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_regular_pool)


def test_month_windows_are_past_only_and_ordered():
    windows = build_regular_pool.month_windows(
        date(2026, 11, 25), months=2, window_days=7
    )

    assert windows[0][0] == date(2026, 11, 15)
    assert windows[0][-1] == date(2026, 11, 21)
    assert windows[1][0] == date(2026, 10, 15)
    assert windows[1][-1] == date(2026, 10, 21)
    assert all(day < date(2026, 11, 25) for window in windows for day in window)


def test_regular_from_counts_requires_both_thresholds():
    counts = Counter({"resident": 5, "oneday": 5, "rare": 1})
    seen = defaultdict(set)
    for day in range(1, 6):
        seen["resident"].add(date(2026, 1, day))
    seen["oneday"].add(date(2026, 1, 1))
    seen["rare"].add(date(2026, 1, 1))

    result = build_regular_pool.regular_from_counts(
        counts, seen, min_observations=5, min_days=3
    )

    assert result == ["resident"]


def test_build_pool_unions_months_and_drops_single_day_species(monkeypatch):
    subregions = [{"code": "GB-ENG", "name": "England"}]
    windows = [
        [date(2026, 1, 15), date(2026, 1, 16), date(2026, 1, 17)],
        [date(2026, 6, 15), date(2026, 6, 16), date(2026, 6, 17)],
    ]

    def fake_fetch(code, dates, *, api_key, delay):
        del code, api_key, delay
        counts = Counter()
        seen = defaultdict(set)
        for day in dates:
            counts["winter"] += 1
            seen["winter"].add(day)
        if dates[0].month == 6:
            for day in dates:
                counts["summer"] += 1
                seen["summer"].add(day)
        counts["vagrant"] += 3
        seen["vagrant"].add(dates[0])
        return counts, seen, set(dates), []

    monkeypatch.setattr(build_regular_pool, "fetch_observation_counts", fake_fetch)

    pool = build_regular_pool.build_pool(
        subregions,
        windows,
        api_key="test-key",
        min_observations=3,
        min_days=3,
        delay=0,
    )

    assert pool == {"England": ["summer", "winter"]}


def test_fetch_observation_counts_keeps_successful_days(monkeypatch):
    dates = [date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3)]

    def fake_get_json(url, **kwargs):
        del kwargs
        if "2026/1/2" in url:
            raise requests.RequestException("timeout")
        return [
            {"speciesCode": "amerob", "obsValid": True},
            {"speciesCode": "invalid", "obsValid": False},
        ]

    monkeypatch.setattr(build_regular_pool.ebird_api_common, "get_json", fake_get_json)

    counts, seen, successful, errors = build_regular_pool.fetch_observation_counts(
        "GB-ENG", dates, api_key="test-key", delay=0
    )

    assert successful == {dates[0], dates[2]}
    assert counts["amerob"] == 2
    assert "invalid" not in counts
    assert len(errors) == 1


def test_main_writes_pool(monkeypatch, tmp_path):
    subregions = tmp_path / "gb-subregions.json"
    output = tmp_path / "gb-regular-species.json"
    subregions.write_text(
        json.dumps([{"code": "GB-ENG", "name": "England"}]), encoding="utf-8"
    )
    monkeypatch.setattr(
        build_regular_pool.ebird_api_common, "load_api_key", lambda: "k"
    )
    monkeypatch.setattr(
        build_regular_pool,
        "build_pool",
        lambda *args, **kwargs: {"England": ["amerob"]},
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build-regular-pool.py",
            "--region",
            "GB",
            "--subregions-file",
            str(subregions),
            "--output",
            str(output),
        ],
    )

    assert build_regular_pool.main() == 0
    assert json.loads(output.read_text(encoding="utf-8")) == {"England": ["amerob"]}


def test_main_rejects_thin_pool(monkeypatch, tmp_path):
    subregions = tmp_path / "gb-subregions.json"
    output = tmp_path / "gb-regular-species.json"
    subregions.write_text(
        json.dumps([{"code": "GB-ENG", "name": "England"}]), encoding="utf-8"
    )
    monkeypatch.setattr(
        build_regular_pool.ebird_api_common, "load_api_key", lambda: "k"
    )
    monkeypatch.setattr(
        build_regular_pool, "build_pool", lambda *args, **kwargs: {"England": []}
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build-regular-pool.py",
            "--region",
            "GB",
            "--subregions-file",
            str(subregions),
            "--output",
            str(output),
        ],
    )

    assert build_regular_pool.main() == 2
    assert not output.exists()
