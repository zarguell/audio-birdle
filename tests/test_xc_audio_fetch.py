"""Tests for xc-audio-fetch.py script (Xeno-canto API v3 audio fetcher)."""

import json
import os
import sys
import time

import pytest
import requests

scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, scripts_dir)

import importlib.util

spec = importlib.util.spec_from_file_location(
    "xc_audio_fetch", os.path.join(scripts_dir, "xc-audio-fetch.py")
)
xc_audio_fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xc_audio_fetch)

TEST_KEY = "t" + "-key"


def make_recording(**overrides):
    """Build a minimal XC recording object with test overrides."""
    recording = {
        "id": "694038",
        "gen": "Turdus",
        "sp": "migratorius",
        "en": "American Robin",
        "rec": "Jacobo Ramil",
        "cnt": "United States",
        "loc": "Ithaca, New York",
        "type": "song",
        "url": "https://xeno-canto.org/694038",
        "file": "https://xeno-canto.org/694038/download",
        "lic": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
        "q": "A",
        "length": "0:45",
        "date": "2021-12-23",
        "also": ["Turdus viscivorus"],
    }
    recording.update(overrides)
    return recording


class TestParseLength:
    """Test XC length string parsing"""

    @staticmethod
    def test_minutes_seconds():
        assert xc_audio_fetch.parse_length("4:08") == 248

    @staticmethod
    def test_hours_minutes_seconds():
        assert xc_audio_fetch.parse_length("1:02:33") == 3753

    @staticmethod
    def test_seconds_only():
        assert xc_audio_fetch.parse_length("37") == 37

    @staticmethod
    def test_empty_and_invalid():
        assert xc_audio_fetch.parse_length("") is None
        assert xc_audio_fetch.parse_length(None) is None
        assert xc_audio_fetch.parse_length("abc") is None
        assert xc_audio_fetch.parse_length("1:xx") is None


class TestBuildQuery:
    """Test XC API query construction"""

    @staticmethod
    def test_species_only():
        query = xc_audio_fetch.build_query("Turdus migratorius")
        assert query == 'sp:"Turdus migratorius" grp:birds'

    @staticmethod
    def test_species_and_country():
        query = xc_audio_fetch.build_query("Turdus migratorius", country="United States")
        assert 'cnt:"United States"' in query
        assert 'sp:"Turdus migratorius"' in query

    @staticmethod
    def test_full_query():
        query = xc_audio_fetch.build_query(
            "Turdus migratorius", country="United States", sound_type="song"
        )
        assert query == 'sp:"Turdus migratorius" grp:birds cnt:"United States" type:song'


class TestIsRestricted:
    """Test restricted-species detection"""

    @staticmethod
    def test_normal_recording():
        assert not xc_audio_fetch.is_restricted(make_recording())

    @staticmethod
    def test_redacted_file():
        recording = make_recording(
            _meta={"redacted_fields": {"file": "restricted_species"}}
        )
        assert xc_audio_fetch.is_restricted(recording)

    @staticmethod
    def test_missing_file():
        assert xc_audio_fetch.is_restricted(make_recording(file=""))


class TestSelectRecordings:
    """Test filtering and ranking of recordings"""

    @staticmethod
    def test_quality_threshold():
        recordings = [
            make_recording(id="1", q="D"),
            make_recording(id="2", q="B"),
            make_recording(id="3", q="A"),
        ]
        selected = xc_audio_fetch.select_recordings(
            recordings, min_quality="C", min_length_sec=0, max_length_sec=3600
        )
        assert [r["id"] for r in selected] == ["3", "2"]

    @staticmethod
    def test_unrated_excluded():
        recordings = [make_recording(id="1", q=""), make_recording(id="2", q="nope")]
        selected = xc_audio_fetch.select_recordings(
            recordings, min_quality="C", min_length_sec=0, max_length_sec=3600
        )
        assert selected == []

    @staticmethod
    def test_length_filtering():
        recordings = [
            make_recording(id="1", length="0:02"),
            make_recording(id="2", length="0:45"),
            make_recording(id="3", length="45:00"),
        ]
        selected = xc_audio_fetch.select_recordings(
            recordings, min_quality="C", min_length_sec=5, max_length_sec=360
        )
        assert [r["id"] for r in selected] == ["2"]

    @staticmethod
    def test_sound_type_preferred_over_other_types():
        recordings = [
            make_recording(id="1", type="call", q="A"),
            make_recording(id="2", type="song", q="A"),
        ]
        selected = xc_audio_fetch.select_recordings(
            recordings,
            sound_type="song",
            min_quality="C",
            min_length_sec=0,
            max_length_sec=3600,
        )
        assert selected[0]["id"] == "2"

    @staticmethod
    def test_restricted_skipped():
        recordings = [
            make_recording(id="1", _meta={"redacted_fields": {"file": "x"}}),
            make_recording(id="2"),
        ]
        selected = xc_audio_fetch.select_recordings(
            recordings, min_quality="C", min_length_sec=0, max_length_sec=3600
        )
        assert [r["id"] for r in selected] == ["2"]

    @staticmethod
    def test_max_urls_limit():
        recordings = [make_recording(id=str(i)) for i in range(25)]
        selected = xc_audio_fetch.select_recordings(
            recordings,
            min_quality="C",
            min_length_sec=0,
            max_length_sec=3600,
            max_urls=10,
        )
        assert len(selected) == 10

    @staticmethod
    def test_deterministic_ordering():
        recordings = [make_recording(id=str(i)) for i in range(5, 0, -1)]
        selected = xc_audio_fetch.select_recordings(
            recordings, min_quality="C", min_length_sec=0, max_length_sec=3600
        )
        assert [r["id"] for r in selected] == ["1", "2", "3", "4", "5"]


class TestToOutputRecord:
    """Test conversion to pipeline URL records"""

    @staticmethod
    def test_legacy_keys_present():
        recording = make_recording()
        record = xc_audio_fetch.to_output_record("amerob", recording)
        assert record["code"] == "amerob"
        assert record["page Url"] == "https://xeno-canto.org/694038"
        assert record["audio Url"] == "https://xeno-canto.org/694038/download"

    @staticmethod
    def test_metadata_keys_present():
        recording = make_recording()
        record = xc_audio_fetch.to_output_record("amerob", recording)
        assert record["quality"] == "A"
        assert record["recordist"] == "Jacobo Ramil"
        assert record["license"].startswith("https://creativecommons.org")
        assert record["recordedOn"] == "2021-12-23"
        assert record["location"] == "Ithaca, New York"
        assert record["country"] == "United States"
        assert record["soundType"] == "song"
        assert record["backgroundSpecies"] == ["Turdus viscivorus"]
        assert record["source"] == "xeno-canto"
        assert record["xcId"] == 694038

    @staticmethod
    def test_quality_normalized():
        record = xc_audio_fetch.to_output_record(
            "amerob", make_recording(q=" b ")
        )
        assert record["quality"] == "B"


class TestFetchRecordings:
    """Test API interaction with mocked responses"""

    @staticmethod
    def test_fetch_single_page(monkeypatch):
        payload = {
            "numRecordings": "2",
            "numPages": 1,
            "page": 1,
            "recordings": [make_recording(id="1"), make_recording(id="2")],
        }
        calls = []

        def fake_get_json(url, params, api_key, **kwargs):
            calls.append(params)
            return payload

        monkeypatch.setattr(xc_audio_fetch, "get_json", fake_get_json)
        recordings = xc_audio_fetch.fetch_recordings(
            "Turdus migratorius",
            country="United States",
            sound_type="song",
            api_key=TEST_KEY,
        )
        assert len(recordings) == 2
        assert len(calls) == 1
        assert calls[0]["query"] == (
            'sp:"Turdus migratorius" grp:birds cnt:"United States" type:song'
        )
        assert calls[0]["key"] == TEST_KEY

    @staticmethod
    def test_fetch_pagination(monkeypatch):
        pages = [
            {
                "numPages": 2,
                "page": 1,
                "recordings": [make_recording(id="1")],
            },
            {
                "numPages": 2,
                "page": 2,
                "recordings": [make_recording(id="2")],
            },
        ]
        calls = []

        def fake_get_json(url, params, api_key, **kwargs):
            calls.append(params["page"])
            return pages[params["page"] - 1]

        monkeypatch.setattr(xc_audio_fetch, "get_json", fake_get_json)
        recordings = xc_audio_fetch.fetch_recordings(
            "Turdus migratorius", api_key=TEST_KEY
        )
        assert [r["id"] for r in recordings] == ["1", "2"]
        assert calls == [1, 2]

    @staticmethod
    def test_fetch_max_pages_respected(monkeypatch):
        def fake_get_json(url, params, api_key, **kwargs):
            return {
                "numPages": 10,
                "page": params["page"],
                "recordings": [make_recording(id=str(params["page"]))],
            }

        monkeypatch.setattr(xc_audio_fetch, "get_json", fake_get_json)
        recordings = xc_audio_fetch.fetch_recordings(
            "Turdus migratorius", api_key=TEST_KEY, max_pages=2
        )
        assert len(recordings) == 2


class TestGetJson:
    """Test retry/backoff behavior of the raw API getter"""

    @staticmethod
    def test_success(monkeypatch):
        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"recordings": []}

        monkeypatch.setattr(
            requests, "get", lambda *a, **kw: FakeResponse()
        )
        result = xc_audio_fetch.get_json(
            "https://example.com", {}, api_key="k"
        )
        assert result == {"recordings": []}

    @staticmethod
    def test_retries_then_raises(monkeypatch):
        class BadResponse:
            def raise_for_status(self):
                raise requests.HTTPError("500")

        sleeps = []
        monkeypatch.setattr(time, "sleep", lambda s: sleeps.append(s))
        monkeypatch.setattr(
            requests, "get", lambda *a, **kw: BadResponse()
        )
        with pytest.raises(requests.HTTPError):
            xc_audio_fetch.get_json(
                "https://example.com", {}, api_key="k", retries=3
            )
        # Backoff: 1s, 2s between the three attempts
        assert sleeps == [1, 2]


class TestLoadApiKey:
    """Test API key loading"""

    @staticmethod
    def test_cli_key_wins():
        assert xc_audio_fetch.load_api_key("cli-key") == "cli-key"

    @staticmethod
    def test_env_key(monkeypatch):
        monkeypatch.setattr(
            xc_audio_fetch, "load_dotenv", lambda: None
        )
        monkeypatch.setenv("XC_API_KEY", "env-key")
        assert xc_audio_fetch.load_api_key() == "env-key"

    @staticmethod
    def test_missing_key(monkeypatch):
        monkeypatch.setattr(
            xc_audio_fetch, "load_dotenv", lambda: None
        )
        monkeypatch.delenv("XC_API_KEY", raising=False)
        with pytest.raises(ValueError, match="XC_API_KEY"):
            xc_audio_fetch.load_api_key()


class TestEndToEndMain:
    """Test the full main() flow with a mocked API"""

    @staticmethod
    def test_main_writes_urls_file(monkeypatch, tmp_path, capsys):
        taxonomy = [
            {
                "speciesCode": "amerob",
                "sciName": "Turdus migratorius",
                "comName": "American Robin",
            },
            {
                "speciesCode": "nosong1",
                "sciName": "Nobirdus nonexistentus",
                "comName": "Fake Bird",
            },
        ]
        taxonomy_file = tmp_path / "test-taxonomy.json"
        taxonomy_file.write_text(json.dumps(taxonomy))
        output_file = tmp_path / "test-taxonomy-urls.json"

        payload = {
            "numRecordings": "1",
            "numPages": 1,
            "recordings": [make_recording()],
        }

        def fake_get_json(url, params, api_key, **kwargs):
            # The fallback (no sound type) query also returns nothing
            if "Nobirdus" in params["query"]:
                return {"numRecordings": "0", "numPages": 1, "recordings": []}
            return payload

        monkeypatch.setattr(xc_audio_fetch, "get_json", fake_get_json)
        monkeypatch.setattr(time, "sleep", lambda s: None)
        monkeypatch.setattr(
            xc_audio_fetch, "load_api_key", lambda cli_key=None: "test-key"
        )
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "xc-audio-fetch.py",
                str(taxonomy_file),
                "--country",
                "US",
                "--tag",
                "song",
                "--max-urls",
                "5",
            ],
        )

        xc_audio_fetch.main()

        records = json.loads(output_file.read_text())
        assert len(records) == 1
        assert records[0]["code"] == "amerob"
        assert records[0]["audio Url"].endswith("/download")
        assert records[0]["recordist"] == "Jacobo Ramil"

        out = capsys.readouterr().out
        assert "1 clips" in out
        assert "No usable recordings found" in out
        assert "Species with audio: 1" in out
        assert f"Audio URLs saved to {output_file}" in out

    @staticmethod
    def test_main_missing_key_exits(monkeypatch, tmp_path, capsys):
        taxonomy_file = tmp_path / "t.json"
        taxonomy_file.write_text("[]")
        monkeypatch.setattr(
            xc_audio_fetch,
            "load_api_key",
            lambda cli_key=None: (_ for _ in ()).throw(
                ValueError("XC_API_KEY not found")
            ),
        )
        monkeypatch.setattr(
            sys, "argv", ["xc-audio-fetch.py", str(taxonomy_file)]
        )
        with pytest.raises(SystemExit) as excinfo:
            xc_audio_fetch.main()
        assert excinfo.value.code == 1
        assert "XC_API_KEY" in capsys.readouterr().out

    @staticmethod
    def test_main_api_error_skips_species(monkeypatch, tmp_path, capsys):
        taxonomy = [
            {
                "speciesCode": "amerob",
                "sciName": "Turdus migratorius",
                "comName": "American Robin",
            }
        ]
        taxonomy_file = tmp_path / "t.json"
        taxonomy_file.write_text(json.dumps(taxonomy))
        output_file = tmp_path / "t-urls.json"

        def fake_get_json(url, params, api_key, **kwargs):
            raise requests.ConnectionError("boom")

        monkeypatch.setattr(xc_audio_fetch, "get_json", fake_get_json)
        monkeypatch.setattr(time, "sleep", lambda s: None)
        monkeypatch.setattr(
            xc_audio_fetch, "load_api_key", lambda cli_key=None: "test-key"
        )
        monkeypatch.setattr(
            sys, "argv", ["xc-audio-fetch.py", str(taxonomy_file)]
        )

        xc_audio_fetch.main()

        records = json.loads(output_file.read_text())
        assert records == []
        out = capsys.readouterr().out
        assert "API error, skipping" in out
        assert "Species with audio: 0" in out
