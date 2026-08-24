"""Tests for enhance-bird-data.py script (in-place birds.json enhancement)."""

import json
import os
import sys

import pytest

scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, scripts_dir)

import importlib.util

spec = importlib.util.spec_from_file_location(
    "enhance_bird_data", os.path.join(scripts_dir, "enhance-bird-data.py")
)
enhance_bird_data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enhance_bird_data)


def make_bird(**overrides):
    """Build a minimal bird record with legacy string audioUrls."""
    bird = {
        "id": "amerob",
        "name": "American Robin",
        "scientificName": "Turdus migratorius",
        "order": "Passeriformes",
        "family": "Turdidae (Thrushes)",
        "audioUrl": ["https://cdn.download.ams.birds.cornell.edu/api/v2/asset/1/mp3"],
        "images": [],
        "facts": "",
        "learnMoreUrl": "",
    }
    bird.update(overrides)
    return bird


def make_xc_entry(url, quality="A"):
    """Build a normalized XC clip entry."""
    return {
        "url": url,
        "attribution": {
            "quality": quality,
            "recordist": "Jacobo Ramil",
            "license": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
            "source": "xeno-canto",
        },
    }


class TestNormalizeAudioUrls:
    """Test conversion of legacy string clips to attributed objects"""

    @staticmethod
    def test_strings_become_objects():
        bird = make_bird(
            audioUrl=["https://cdn.download.ams.birds.cornell.edu/api/v2/asset/1/mp3"]
        )
        converted = enhance_bird_data.normalize_audio_urls(bird)
        assert converted == 1
        assert bird["audioUrl"] == [
            {
                "url": "https://cdn.download.ams.birds.cornell.edu/api/v2/asset/1/mp3",
                "attribution": {"source": "macaulay-library"},
            }
        ]

    @staticmethod
    def test_non_cdn_string_gets_empty_attribution():
        bird = make_bird(audioUrl=["https://example.com/clip.mp3"])
        converted = enhance_bird_data.normalize_audio_urls(bird)
        assert converted == 1
        assert bird["audioUrl"] == [{"url": "https://example.com/clip.mp3", "attribution": {}}]

    @staticmethod
    def test_objects_pass_through_unchanged():
        entry = make_xc_entry("https://xeno-canto.org/1/download")
        bird = make_bird(audioUrl=[entry])
        converted = enhance_bird_data.normalize_audio_urls(bird)
        assert converted == 0
        assert bird["audioUrl"] == [entry]

    @staticmethod
    def test_non_https_and_garbage_dropped():
        bird = make_bird(
            audioUrl=["http://insecure.mp3", "not a url", 42,
                      "https://ok.mp3"]
        )
        enhance_bird_data.normalize_audio_urls(bird)
        assert [e["url"] for e in bird["audioUrl"]] == ["https://ok.mp3"]

    @staticmethod
    def test_missing_audio_url_safe():
        bird = make_bird()
        del bird["audioUrl"]
        assert enhance_bird_data.normalize_audio_urls(bird) == 0


class TestBackfillLearnMore:
    """Test learnMoreUrl backfill"""

    @staticmethod
    def test_empty_gets_ebird_link():
        bird = make_bird()
        assert enhance_bird_data.backfill_learn_more(bird) is True
        assert bird["learnMoreUrl"] == "https://ebird.org/species/amerob"

    @staticmethod
    def test_existing_value_preserved():
        bird = make_bird(learnMoreUrl="https://example.com/page")
        assert enhance_bird_data.backfill_learn_more(bird) is False
        assert bird["learnMoreUrl"] == "https://example.com/page"

    @staticmethod
    def test_missing_id_skipped():
        bird = make_bird()
        del bird["id"]
        assert enhance_bird_data.backfill_learn_more(bird) is False


class TestMergeXcClips:
    """Test merging Xeno-canto clips into a bird"""

    @staticmethod
    def test_appends_after_existing_clips():
        bird = make_bird(audioUrl=["https://ml.example/1.mp3"])
        enhance_bird_data.normalize_audio_urls(bird)
        entries = [make_xc_entry("https://xc.example/1.mp3")]
        added = enhance_bird_data.merge_xc_clips(bird, entries)
        assert added == 1
        assert bird["audioUrl"][0]["url"] == "https://ml.example/1.mp3"
        assert bird["audioUrl"][1]["url"] == "https://xc.example/1.mp3"

    @staticmethod
    def test_duplicates_skipped():
        bird = make_bird(audioUrl=[{"url": "https://xc.example/1.mp3", "attribution": {}}])
        entries = [make_xc_entry("https://xc.example/1.mp3")]
        assert enhance_bird_data.merge_xc_clips(bird, entries) == 0

    @staticmethod
    def test_best_quality_first():
        bird = make_bird(audioUrl=["https://ml.example/1.mp3"])
        enhance_bird_data.normalize_audio_urls(bird)
        entries = [
            make_xc_entry("https://xc.example/c.mp3", quality="C"),
            make_xc_entry("https://xc.example/a.mp3", quality="A"),
            make_xc_entry("https://xc.example/b.mp3", quality="B"),
        ]
        enhance_bird_data.merge_xc_clips(bird, entries)
        urls = [e["url"] for e in bird["audioUrl"]]
        assert urls[1:] == [
            "https://xc.example/a.mp3",
            "https://xc.example/b.mp3",
            "https://xc.example/c.mp3",
        ]

    @staticmethod
    def test_respects_max_clips():
        bird = make_bird(audioUrl=["https://ml.example/1.mp3"])
        entries = [make_xc_entry(f"https://xc.example/{i}.mp3") for i in range(20)]
        added = enhance_bird_data.merge_xc_clips(bird, entries, max_clips=5)
        assert added == 4
        assert len(bird["audioUrl"]) == 5

    @staticmethod
    def test_no_entries_no_change():
        bird = make_bird()
        assert enhance_bird_data.merge_xc_clips(bird, []) == 0


class TestEnhanceRegion:
    """Test the full per-region pipeline"""

    @staticmethod
    def test_offline_enhancements():
        birds = [make_bird(), make_bird(id="barswa", audioUrl=[])]
        stats = enhance_bird_data.enhance_region(birds)
        assert stats["clips_normalized"] == 1
        assert stats["learn_more_added"] == 2
        assert all(
            isinstance(entry, dict) for b in birds for entry in b["audioUrl"]
        )
        assert birds[0]["learnMoreUrl"] == "https://ebird.org/species/amerob"
        assert birds[1]["learnMoreUrl"] == "https://ebird.org/species/barswa"

    @staticmethod
    def test_xc_merge_stats():
        birds = [make_bird()]
        xc = {"amerob": [make_xc_entry("https://xc.example/1.mp3")]}
        stats = enhance_bird_data.enhance_region(birds, xc_by_code=xc)
        assert stats["species_with_xc_added"] == 1
        assert stats["xc_clips_added"] == 1

    @staticmethod
    def test_single_clip_count_improves():
        birds = [make_bird()]  # one bird, one clip
        xc = {"amerob": [make_xc_entry("https://xc.example/1.mp3")]}
        stats = enhance_bird_data.enhance_region(birds, xc_by_code=xc)
        assert stats["species_single_clip_before"] == 1
        assert stats["species_single_clip_after"] == 0

    @staticmethod
    def test_species_never_dropped():
        birds = [make_bird(), make_bird(id="rare1", audioUrl=[])]
        xc = {"unknown1": [make_xc_entry("https://xc.example/x.mp3")]}
        enhance_bird_data.enhance_region(birds, xc_by_code=xc)
        assert {b["id"] for b in birds} == {"amerob", "rare1"}

    @staticmethod
    def test_learn_more_disabled():
        birds = [make_bird()]
        stats = enhance_bird_data.enhance_region(birds, learn_more=False)
        assert stats.get("learn_more_added", 0) == 0
        assert birds[0]["learnMoreUrl"] == ""


class TestLoadXcEntries:
    """Test loading xc-audio-fetch.py output"""

    @staticmethod
    def test_groups_by_code_with_attribution(tmp_path):
        records = [
            {
                "code": "amerob",
                "audio Url": "https://xeno-canto.org/694038/download",
                "quality": "A",
                "recordist": "Jacobo Ramil",
                "source": "xeno-canto",
            },
            {"code": "amerob", "audio Url": ""},
            {"code": "", "audio Url": "https://xeno-canto.org/1/download"},
        ]
        path = tmp_path / "urls.json"
        path.write_text(json.dumps(records))

        grouped = enhance_bird_data.load_xc_entries(path)

        assert list(grouped.keys()) == ["amerob"]
        entry = grouped["amerob"][0]
        assert entry["url"] == "https://xeno-canto.org/694038/download"
        assert entry["attribution"]["recordist"] == "Jacobo Ramil"
        assert entry["attribution"]["quality"] == "A"


class TestEndToEndMain:
    """Test main() CLI flow"""

    @staticmethod
    def test_offline_run_writes_file(monkeypatch, tmp_path, capsys):
        birds_file = tmp_path / "birds.json"
        birds_file.write_text(
            json.dumps(
                {
                    "us": [
                        make_bird(),
                        make_bird(
                            id="barswa",
                            audioUrl=["https://cdn.download.ams.birds.cornell.edu/api/v2/asset/2/mp3"],
                        ),
                    ]
                }
            )
        )
        monkeypatch.setattr(
            sys, "argv", ["enhance-bird-data.py", str(birds_file)]
        )
        enhance_bird_data.main()

        data = json.loads(birds_file.read_text())
        for bird in data["us"]:
            assert bird["learnMoreUrl"].startswith("https://ebird.org/species/")
            for entry in bird["audioUrl"]:
                assert isinstance(entry, dict) and "url" in entry
        out = capsys.readouterr().out
        assert "clips_normalized: 2" in out
        assert "learn_more_added: 2" in out
        assert "Enhanced data written" in out

    @staticmethod
    def test_dry_run_leaves_file_untouched(monkeypatch, tmp_path, capsys):
        birds_file = tmp_path / "birds.json"
        original = json.dumps({"us": [make_bird()]})
        birds_file.write_text(original)
        monkeypatch.setattr(
            sys,
            "argv",
            ["enhance-bird-data.py", str(birds_file), "--dry-run"],
        )
        enhance_bird_data.main()
        assert birds_file.read_text() == original
        assert "Dry run: no changes written" in capsys.readouterr().out

    @staticmethod
    def test_xc_merge_end_to_end(monkeypatch, tmp_path, capsys):
        birds_file = tmp_path / "birds.json"
        birds_file.write_text(json.dumps({"us": [make_bird()]}))
        urls_file = tmp_path / "urls.json"
        urls_file.write_text(
            json.dumps(
                [
                    {
                        "code": "amerob",
                        "audio Url": "https://xeno-canto.org/694038/download",
                        "quality": "A",
                        "recordist": "Jacobo Ramil",
                    },
                    {
                        "code": "nosuch1",
                        "audio Url": "https://xeno-canto.org/2/download",
                    },
                ]
            )
        )
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "enhance-bird-data.py",
                str(birds_file),
                "--xc-urls",
                str(urls_file),
            ],
        )
        enhance_bird_data.main()

        data = json.loads(birds_file.read_text())
        audio = data["us"][0]["audioUrl"]
        assert len(audio) == 2
        assert audio[1]["url"] == "https://xeno-canto.org/694038/download"
        assert audio[1]["attribution"]["recordist"] == "Jacobo Ramil"
        out = capsys.readouterr().out
        assert "xc_clips_added: 1" in out
        assert "unmatched (not in birds.json): 1" in out

    @staticmethod
    def test_missing_file_exits(monkeypatch, tmp_path, capsys):
        monkeypatch.setattr(
            sys,
            "argv",
            ["enhance-bird-data.py", str(tmp_path / "nope.json")],
        )
        with pytest.raises(SystemExit) as excinfo:
            enhance_bird_data.main()
        assert excinfo.value.code == 1
