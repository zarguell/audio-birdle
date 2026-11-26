"""Tests for verify-daily-coverage.py"""

import importlib.util
import json
import os
from datetime import date, datetime, timedelta

scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
spec = importlib.util.spec_from_file_location(
    "verify_daily_coverage", os.path.join(scripts_dir, "verify-daily-coverage.py")
)
verify_daily_coverage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_daily_coverage)

TODAY = date(2026, 11, 26)
REGIONS = [
    {"id": "us", "name": "United States"},
    {"id": "gb", "name": "United Kingdom"},
]


def _write_data_dir(root, covered):
    """Write regions.json + daily.json covering the given (date, region) pairs."""
    data_dir = root / "public" / "data"
    data_dir.mkdir(parents=True)
    (data_dir / "regions.json").write_text(json.dumps(REGIONS))
    daily = [
        {"date": day, "region": region, "answerHash": "00000000"}
        for day, region in covered
    ]
    (data_dir / "daily.json").write_text(json.dumps(daily))
    return data_dir


def _full_window():
    return [
        ((TODAY + timedelta(days=offset)).isoformat(), region["id"])
        for offset in range(8)
        for region in REGIONS
    ]


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return datetime(2026, 11, 26, 12, 0, tzinfo=tz)


def test_full_window_has_no_missing_entries(tmp_path):
    data_dir = _write_data_dir(tmp_path, _full_window())
    assert verify_daily_coverage.find_missing_entries(data_dir, TODAY, 2) == []


def test_window_runs_from_today_forward(tmp_path):
    # Only today is covered: tomorrow must be reported as missing.
    tomorrow = (TODAY + timedelta(days=1)).isoformat()
    data_dir = _write_data_dir(
        tmp_path, [(TODAY.isoformat(), region["id"]) for region in REGIONS]
    )
    assert verify_daily_coverage.find_missing_entries(data_dir, TODAY, 2) == [
        f"us {tomorrow}",
        f"gb {tomorrow}",
    ]


def test_missing_region_day_is_reported(tmp_path):
    data_dir = _write_data_dir(tmp_path, [(TODAY.isoformat(), "us")])
    assert verify_daily_coverage.find_missing_entries(data_dir, TODAY, 2) == [
        "gb 2026-11-26",
        "us 2026-11-27",
        "gb 2026-11-27",
    ]


def test_main_passes_when_window_is_covered(tmp_path, monkeypatch, capsys):
    data_dir = _write_data_dir(tmp_path, _full_window())
    monkeypatch.setattr(verify_daily_coverage, "datetime", _FixedDatetime)

    assert verify_daily_coverage.main(["--data-dir", str(data_dir)]) == 0
    assert "covers every region" in capsys.readouterr().out


def test_main_fails_and_lists_missing_entries(tmp_path, monkeypatch, capsys):
    data_dir = _write_data_dir(tmp_path, [(TODAY.isoformat(), "us")])
    monkeypatch.setattr(verify_daily_coverage, "datetime", _FixedDatetime)

    assert verify_daily_coverage.main(["--data-dir", str(data_dir)]) == 1
    out = capsys.readouterr().out
    assert "3 required daily entries are missing" in out
