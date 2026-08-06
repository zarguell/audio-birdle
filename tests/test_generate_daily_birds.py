"""Tests for generate-daily-birds.py script"""

import pytest
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta

# Add scripts directory to path
scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, scripts_dir)

# Import the module
import importlib.util

spec = importlib.util.spec_from_file_location(
    "generate_daily_birds", os.path.join(scripts_dir, "generate-daily-birds.py")
)
generate_daily_birds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_daily_birds)


class TestHashBirdId:
    """Test bird ID hashing"""

    # Expected hash values - must match JavaScript implementation
    # These are the canonical values that both implementations MUST produce
    EXPECTED_HASHES = {
        "": "216da62a",  # empty string + salt
        "test": "af3ad7d8",  # "test" + salt
        "amerob": "104c723e",
        "barswa": "4060c5e0",
        "bird-with-dash": "f0e934a5",
        "TESTBIRD": "0391253f",
        "mallar3": "1f16a85c",
        "hoomer": "5cf9cfd8",
    }

    @staticmethod
    def test_hash_bird_id():
        """Test basic hashing functionality"""
        hash_result = generate_daily_birds.hash_bird_id("amerob")

        assert isinstance(hash_result, str)
        assert len(hash_result) == 8
        assert all(c in "0123456789abcdef" for c in hash_result)

    @staticmethod
    def test_hash_consistency():
        """Test that hashing is consistent"""
        hash1 = generate_daily_birds.hash_bird_id("amerob")
        hash2 = generate_daily_birds.hash_bird_id("amerob")

        assert hash1 == hash2

    @staticmethod
    def test_hash_uniqueness():
        """Test that different IDs produce different hashes"""
        hash1 = generate_daily_birds.hash_bird_id("amerob")
        hash2 = generate_daily_birds.hash_bird_id("barswa")

        assert hash1 != hash2

    @staticmethod
    def test_hash_expected_values():
        """Test that hashes match expected values (must match JavaScript)"""
        for bird_id, expected_hash in TestHashBirdId.EXPECTED_HASHES.items():
            actual_hash = generate_daily_birds.hash_bird_id(bird_id)
            assert actual_hash == expected_hash, (
                f"Hash mismatch for {bird_id}: expected {expected_hash}, got {actual_hash}"
            )

    @staticmethod
    def test_hash_zero_padding():
        """Test that hashes are always zero-padded to 8 characters"""
        # Test with input that would produce short hash without padding
        hash_result = generate_daily_birds.hash_bird_id("TESTBIRD")
        assert len(hash_result) == 8
        assert hash_result == "0391253f"  # Leading zero is critical

    @staticmethod
    def test_hash_lowercase():
        """Test that hash is always lowercase"""
        hash_result = generate_daily_birds.hash_bird_id("TESTBIRD")
        assert hash_result == hash_result.lower()
        assert hash_result == "0391253f"

    @staticmethod
    def test_hash_deterministic():
        """Test that hash is deterministic across multiple calls"""
        bird_id = "amerob"
        iterations = 100
        hashes = [generate_daily_birds.hash_bird_id(bird_id) for _ in range(iterations)]

        # All hashes should be identical
        assert len(set(hashes)) == 1
        assert hashes[0] == "104c723e"

    @staticmethod
    def test_hash_special_characters():
        """Test hashing of bird IDs with special characters"""
        special_ids = [
            "bird-with-dash",
            "bird_with_underscore",
            "bird.with.dot",
        ]

        for bird_id in special_ids:
            hash_result = generate_daily_birds.hash_bird_id(bird_id)
            assert len(hash_result) == 8
            assert all(c in "0123456789abcdef" for c in hash_result)

    @staticmethod
    def test_hash_salt_included():
        """Test that salt is included in hash calculation"""
        # Same bird ID with different salts would produce different hashes
        # We verify the current salt produces expected values
        hash_with_salt = generate_daily_birds.hash_bird_id("amerob")
        assert hash_with_salt == "104c723e"

        # If we changed the salt, this would produce a different hash
        # (we can't test this directly without modifying the function,
        # but we document that the salt is "birdle-salt-2025")


class TestGeneratedHashesValid:
    """Test that generated daily.json hashes are valid"""

    @staticmethod
    def test_daily_json_hashes_exist_in_birds_json():
        """Test that all hashes in daily.json exist in birds.json"""
        # Load daily.json
        daily_path = os.path.join(
            os.path.dirname(__file__), "..", "public", "data", "daily.json"
        )
        with open(daily_path) as f:
            daily_data = json.load(f)

        # Load birds.json
        birds_path = os.path.join(
            os.path.dirname(__file__), "..", "public", "data", "birds.json"
        )
        with open(birds_path) as f:
            birds_data = json.load(f)

        # Check each entry
        for entry in daily_data:
            region = entry["region"]
            answer_hash = entry["answerHash"]

            # Get birds for this region (handle virtual regions)
            region_birds = birds_data.get(region, [])
            if not region_birds:
                # Try to find parent region for virtual regions
                regions_path = os.path.join(
                    os.path.dirname(__file__), "..", "public", "data", "regions.json"
                )
                with open(regions_path) as rf:
                    regions = json.load(rf)
                for r in regions:
                    if r["id"] == region and "parentRegion" in r:
                        region_birds = birds_data.get(r["parentRegion"], [])
                        break

            # Generate hashes for all birds in this region
            bird_hashes = set()
            for bird in region_birds:
                bird_hash = generate_daily_birds.hash_bird_id(bird["id"])
                bird_hashes.add(bird_hash)

            # Verify the answer hash exists
            assert answer_hash in bird_hashes, (
                f"Hash {answer_hash} for region {region} on {entry['date']} not found in birds database. Available hashes: {sorted(bird_hashes)[:5]}..."
            )


class TestLoadJsonFile:
    """Test JSON loading with error handling"""

    @staticmethod
    def test_load_valid_json(tmp_path):
        """Test loading a valid JSON file"""
        test_data = {"test": "data"}
        test_file = tmp_path / "test.json"
        test_file.write_text(json.dumps(test_data))

        result = generate_daily_birds.load_json_file(str(test_file))

        assert result == test_data

    @staticmethod
    def test_load_nonexistent_history_file(tmp_path, capsys):
        """Test that non-existent history file returns empty dict"""
        result = generate_daily_birds.load_json_file(str(tmp_path / "history.json"))

        captured = capsys.readouterr()
        assert "Warning:" in captured.out
        assert result == {}

    @staticmethod
    def test_load_nonexistent_other_file(tmp_path, capsys):
        """Test that non-existent non-history file returns empty list"""
        result = generate_daily_birds.load_json_file(str(tmp_path / "birds.json"))

        assert result == []

    @staticmethod
    def test_load_invalid_json(tmp_path):
        """Test handling of invalid JSON"""
        invalid_file = tmp_path / "invalid.json"
        invalid_file.write_text("{ invalid json }")

        with pytest.raises(SystemExit):
            generate_daily_birds.load_json_file(str(invalid_file))

    @staticmethod
    def test_load_empty_json(tmp_path):
        """Test loading empty JSON object"""
        empty_file = tmp_path / "empty.json"
        empty_file.write_text("{}")

        result = generate_daily_birds.load_json_file(str(empty_file))

        assert result == {}


class TestGetRecentAnswers:
    """Test recent answer retrieval"""

    @staticmethod
    def test_get_recent_answers_empty_history():
        """Test with empty history"""
        history = {}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 30, current_date
        )

        assert recent == set()

    @staticmethod
    def test_get_recent_answers_within_window(sample_history_data):
        """Test getting answers within the time window"""
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            sample_history_data, "us", 10, current_date
        )

        # "amerob" was on 2025-12-25 (2 days ago) - should be included
        assert "amerob" in recent

    @staticmethod
    def test_get_recent_answers_outside_window():
        """Test that old answers are excluded"""
        old_history = {
            "us": [{"date": "2025-11-01", "id": "oldbird", "subregion": "New York"}]
        }
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            old_history, "us", 30, current_date
        )

        assert "oldbird" not in recent

    @staticmethod
    def test_get_recent_answers_no_region_history():
        """Test with non-existent region"""
        history = {"eu": [{"date": "2025-12-26", "id": "eurbird"}]}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 30, current_date
        )

        assert recent == set()


class TestGetSubregionForDate:
    """Test subregion selection for date"""

    @staticmethod
    def test_get_subregion_no_subregions_data():
        """Test with no subregions data"""
        result = generate_daily_birds.get_subregion_for_date(
            {}, "us", datetime(2025, 12, 27).date()
        )

        assert result == (None, [])

    @staticmethod
    def test_get_subregion_empty_region():
        """Test with empty region data"""
        data = {"us": {}}
        result = generate_daily_birds.get_subregion_for_date(
            data, "us", datetime(2025, 12, 27).date()
        )

        assert result == (None, [])

    @staticmethod
    def test_get_subregion_selects_valid_subregion():
        """Test that it selects a valid subregion"""
        data = {
            "us": {
                "California": [{"id": "bird1"}, {"id": "bird2"}],
                "New York": [{"id": "bird3"}],
            }
        }
        subregion, bird_ids = generate_daily_birds.get_subregion_for_date(
            data, "us", datetime(2025, 12, 27).date()
        )

        assert subregion in ["California", "New York"]
        assert len(bird_ids) > 0
        assert isinstance(bird_ids, set)

    @staticmethod
    def test_get_subregion_deterministic():
        """Test that same date/region produces same subregion"""
        data = {"us": {"California": [{"id": "bird1"}], "New York": [{"id": "bird2"}]}}
        target_date = datetime(2025, 12, 27).date()

        subregion1, _ = generate_daily_birds.get_subregion_for_date(
            data, "us", target_date
        )
        subregion2, _ = generate_daily_birds.get_subregion_for_date(
            data, "us", target_date
        )

        assert subregion1 == subregion2

    @staticmethod
    def test_get_subregion_seed_is_not_python_hash():
        """Test that the seed does not depend on PYTHONHASHSEED (built-in hash)"""
        data = {"us": {"California": [{"id": "bird1"}], "New York": [{"id": "bird2"}]}}
        target_date = datetime(2025, 12, 27).date()

        # Re-seeding the RNG is deterministic for a fixed date+region because
        # the seed is a SHA-256 digest, not the per-process randomized hash().
        # Calling twice in-process proves stability; the subprocess test
        # proves it across different PYTHONHASHSEED values.
        subregions = [
            generate_daily_birds.get_subregion_for_date(data, "us", target_date)[0]
            for _ in range(5)
        ]
        assert len(set(subregions)) == 1


class TestFilterBirdsBySubregion:
    """Test filtering birds by subregion"""

    @staticmethod
    def test_filter_birds_by_subregion_ids():
        """Test filtering birds by subregion IDs"""
        birds = [
            {"id": "bird1", "name": "Bird 1"},
            {"id": "bird2", "name": "Bird 2"},
            {"id": "bird3", "name": "Bird 3"},
        ]
        subregion_ids = {"bird1", "bird3"}

        filtered = generate_daily_birds.filter_birds_by_subregion(birds, subregion_ids)

        assert len(filtered) == 2
        assert all(b["id"] in subregion_ids for b in filtered)

    @staticmethod
    def test_filter_empty_birds_list():
        """Test filtering empty birds list"""
        result = generate_daily_birds.filter_birds_by_subregion([], {"bird1"})

        assert result == []

    @staticmethod
    def test_filter_empty_subregion_ids():
        """Test filtering with empty subregion IDs"""
        birds = [{"id": "bird1", "name": "Bird 1"}]
        result = generate_daily_birds.filter_birds_by_subregion(birds, set())

        # The function returns birds that match the subregion IDs
        # If subregion_ids is empty, it might return all birds or empty
        # Let's check what it actually does
        assert isinstance(result, list)
        # It returns all birds when subregion_ids is empty
        assert len(result) == len(birds)


class TestSaveJsonFile:
    """Test JSON file saving"""

    @staticmethod
    def test_save_json_file(tmp_path):
        """Test saving data to JSON file"""
        test_data = {"key": "value"}
        output_file = tmp_path / "output.json"

        generate_daily_birds.save_json_file(str(output_file), test_data)

        assert output_file.exists()
        with open(output_file) as f:
            saved_data = json.load(f)
        assert saved_data == test_data

    @staticmethod
    def test_save_json_with_complex_data(tmp_path):
        """Test saving complex nested data"""
        test_data = {
            "us": [{"date": "2025-12-27", "region": "us", "answerHash": "abc123"}]
        }
        output_file = tmp_path / "output.json"

        generate_daily_birds.save_json_file(str(output_file), test_data)

        with open(output_file) as f:
            saved_data = json.load(f)
        assert saved_data == test_data


class TestSelectBirdForRegion:
    """Test bird selection logic"""

    @staticmethod
    def test_select_bird_from_full_region_when_subregion_empty():
        """Test that an empty subregion filter falls back to all region birds"""
        birds = [
            {"id": "bird1", "name": "Bird 1"},
            {"id": "bird2", "name": "Bird 2"},
        ]
        # Subregion IDs that match no birds
        subregion_bird_ids = {"nonexistent-bird"}

        selected = generate_daily_birds.select_bird_for_region(
            birds, set(), subregion_bird_ids=subregion_bird_ids
        )

        # Must select from the full region pool, not return None
        assert selected is not None
        assert selected["id"] in {"bird1", "bird2"}

    @staticmethod
    def test_select_bird_returns_none_when_no_birds():
        """Test that None is returned only when no birds exist at all"""
        selected = generate_daily_birds.select_bird_for_region([], set())

        assert selected is None

    @staticmethod
    def test_select_bird_avoids_recent_answers():
        """Test that recently used birds are avoided when possible"""
        birds = [
            {"id": "bird1", "name": "Bird 1"},
            {"id": "bird2", "name": "Bird 2"},
            {"id": "bird3", "name": "Bird 3"},
        ]
        recent_answers = {"bird1", "bird2"}

        selected = generate_daily_birds.select_bird_for_region(birds, recent_answers)

        assert selected["id"] == "bird3"

    @staticmethod
    def test_select_bird_falls_back_to_all_when_all_recent():
        """Test that all birds are used when every bird was recently used"""
        birds = [
            {"id": "bird1", "name": "Bird 1"},
            {"id": "bird2", "name": "Bird 2"},
        ]
        recent_answers = {"bird1", "bird2"}

        selected = generate_daily_birds.select_bird_for_region(birds, recent_answers)

        assert selected is not None
        assert selected["id"] in {"bird1", "bird2"}

    @staticmethod
    def test_select_bird_retries_when_verification_fails():
        """Test that a verification failure retries with a different bird"""
        birds = [
            {"id": "bird1", "name": "Bird 1"},
            {"id": "bird2", "name": "Bird 2"},
        ]
        # birds_data has birds, but none of the candidate birds: verification
        # fails, and the retry must still return one of the remaining birds
        birds_data = {"us": [{"id": "otherbird", "name": "Other Bird"}]}

        selected = generate_daily_birds.select_bird_for_region(
            birds, set(), birds_data=birds_data, region_id="us"
        )

        assert selected is not None
        assert selected["id"] in {"bird1", "bird2"}

    @staticmethod
    def test_select_bird_returns_none_after_failed_retry():
        """Test that None is returned when verification fails and no birds remain"""
        birds = [{"id": "bird1", "name": "Bird 1"}]
        # Region exists but has no birds in birds.json: verification reports
        # the missing region and the retry has nothing left to choose from
        birds_data = {"us": []}

        selected = generate_daily_birds.select_bird_for_region(
            birds, set(), birds_data=birds_data, region_id="us"
        )

        assert selected is None


class TestUpdateHistory:
    """Test history recovery from daily.json"""

    @staticmethod
    def _birds_data():
        return {
            "us": [
                {"id": "amerob", "name": "American Robin"},
                {"id": "barswa", "name": "Barn Swallow"},
            ]
        }

    def test_update_history_writes_real_entry_from_daily_id(self):
        """Test that daily.json 'id' fields produce real history entries"""
        daily_data = [
            {
                "date": "2025-12-26",
                "region": "us",
                "answerHash": "4060c5e0",
                "id": "barswa",
                "subregion": "California",
            }
        ]
        current_date = datetime(2025, 12, 27).date()

        history = generate_daily_birds.update_history(
            {}, daily_data, current_date, self._birds_data()
        )

        assert history == {
            "us": [
                {
                    "date": "2025-12-26",
                    "id": "barswa",
                    "name": "Barn Swallow",
                    "subregion": "California",
                }
            ]
        }

    def test_update_history_upserts_by_region_and_date(self):
        """Test that an existing history entry for the same region+date is replaced"""
        daily_data = [
            {
                "date": "2025-12-26",
                "region": "us",
                "answerHash": "104c723e",
                "id": "amerob",
            }
        ]
        current_date = datetime(2025, 12, 27).date()
        history = {
            "us": [
                {"date": "2025-12-26", "id": "oldbird", "name": "Old Bird"},
                {"date": "2025-12-25", "id": "barswa", "name": "Barn Swallow"},
            ]
        }

        updated = generate_daily_birds.update_history(
            history, daily_data, current_date, self._birds_data()
        )

        # Same length: the 12-26 entry was replaced, not duplicated
        assert len(updated["us"]) == 2
        assert updated["us"][0] == {
            "date": "2025-12-26",
            "id": "amerob",
            "name": "American Robin",
        }
        # Unrelated entry untouched
        assert updated["us"][1]["date"] == "2025-12-25"

    def test_update_history_skips_entries_without_id(self):
        """Test that legacy daily entries without 'id' are skipped, not crashed on"""
        daily_data = [{"date": "2025-12-26", "region": "us", "answerHash": "104c723e"}]
        current_date = datetime(2025, 12, 27).date()

        history = generate_daily_birds.update_history(
            {}, daily_data, current_date, self._birds_data()
        )

        assert history == {}

    def test_update_history_resolves_virtual_region_parent(self):
        """Test that names are looked up in the parent region for virtual regions"""
        daily_data = [
            {
                "date": "2025-12-26",
                "region": "us-lower48",
                "answerHash": "104c723e",
                "id": "amerob",
            }
        ]
        current_date = datetime(2025, 12, 27).date()
        virtual_regions = {
            "us-lower48": {"parent": "us", "excludedSubregions": ["Alaska", "Hawaii"]}
        }

        history = generate_daily_birds.update_history(
            {}, daily_data, current_date, self._birds_data(), virtual_regions
        )

        assert history["us-lower48"][0]["name"] == "American Robin"

    def test_update_history_falls_back_to_id_when_bird_unknown(self, capsys):
        """Test that an unknown bird id is used as the name with a warning"""
        daily_data = [
            {
                "date": "2025-12-26",
                "region": "us",
                "answerHash": "00000000",
                "id": "ghostbird",
            }
        ]
        current_date = datetime(2025, 12, 27).date()

        history = generate_daily_birds.update_history(
            {}, daily_data, current_date, self._birds_data()
        )

        captured = capsys.readouterr()
        assert "could not find bird 'ghostbird'" in captured.out
        assert history["us"][0]["name"] == "ghostbird"


class TestVirtualRegions:
    """Test virtual region functionality via build_region_birds"""

    @staticmethod
    def _target_date():
        return datetime(2025, 12, 27).date()

    def test_virtual_region_subregion_filtering(self):
        """Test that virtual regions inherit and exclude subregions from parent"""

        # Subregions data structure from subregions.json (parent region key)
        subregions_data = {
            "us": {
                "California": [{"id": "bird1"}],
                "Texas": [{"id": "bird2"}],
                "Alaska": [{"id": "bird3"}],  # Should be excluded
                "Hawaii": [{"id": "bird4"}],  # Should be excluded
            }
        }

        virtual_regions = {
            "us-lower48": {"parent": "us", "excludedSubregions": ["Alaska", "Hawaii"]}
        }

        _, selected_subregion, subregion_bird_ids = (
            generate_daily_birds.build_region_birds(
                "us-lower48",
                {},
                virtual_regions,
                subregions_data,
                self._target_date(),
            )
        )

        # Alaska and Hawaii must never be selected for the virtual region
        assert selected_subregion in ["California", "Texas"]
        assert subregion_bird_ids in [{"bird1"}, {"bird2"}]

    def test_virtual_region_bird_lookup(self):
        """Test that virtual regions fall back to parent region's birds"""
        birds_data = {
            "us": [{"id": "bird1", "name": "Bird 1"}],
            "us-lower48": [],  # Empty for virtual region
        }

        virtual_regions = {
            "us-lower48": {"parent": "us", "excludedSubregions": ["Alaska"]}
        }

        region_birds, _, _ = generate_daily_birds.build_region_birds(
            "us-lower48",
            birds_data,
            virtual_regions,
            {},
            self._target_date(),
        )

        # Should have gotten parent region's birds
        assert len(region_birds) == 1
        assert region_birds[0]["id"] == "bird1"

    def test_virtual_region_empty_after_exclusions(self):
        """Test handling when all subregions are excluded"""
        subregions_data = {
            "us": {
                "Alaska": [{"id": "bird1"}],
                "Hawaii": [{"id": "bird2"}],
            }
        }

        virtual_regions = {
            "us-lower48": {"parent": "us", "excludedSubregions": ["Alaska", "Hawaii"]}
        }

        _, selected_subregion, subregion_bird_ids = (
            generate_daily_birds.build_region_birds(
                "us-lower48",
                {},
                virtual_regions,
                subregions_data,
                self._target_date(),
            )
        )

        # Should have no valid subregions remaining
        assert selected_subregion is None
        assert subregion_bird_ids == []

    def test_virtual_region_no_exclusions(self):
        """Test virtual region with no excluded subregions"""
        subregions_data = {
            "us": {
                "California": [{"id": "bird1"}],
                "Texas": [{"id": "bird2"}],
            }
        }

        virtual_regions = {"us-lower48": {"parent": "us", "excludedSubregions": []}}

        _, selected_subregion, subregion_bird_ids = (
            generate_daily_birds.build_region_birds(
                "us-lower48",
                {},
                virtual_regions,
                subregions_data,
                self._target_date(),
            )
        )

        # One of the parent subregions should be selected
        assert selected_subregion in ["California", "Texas"]
        assert subregion_bird_ids in [{"bird1"}, {"bird2"}]


class TestMainEndToEnd:
    """End-to-end tests for main() on a temp data directory"""

    @staticmethod
    def _write_data_dir(root, prior_daily=None):
        """Write a minimal public/data tree under root; returns paths dict."""
        data_dir = root / "public" / "data"
        data_dir.mkdir(parents=True, exist_ok=True)

        regions = [
            {"id": "us", "name": "United States"},
            {
                "id": "us-lower48",
                "name": "US Lower 48",
                "parentRegion": "us",
                "excludedSubregions": ["Alaska"],
            },
        ]
        birds = {
            "us": [
                {"id": f"bird{i:02d}", "name": f"Bird {i:02d}"} for i in range(1, 11)
            ]
        }
        subregions = {
            "us": {
                "California": [{"id": "bird01"}, {"id": "bird02"}, {"id": "bird03"}],
                "Texas": [{"id": "bird04"}, {"id": "bird05"}],
                "Alaska": [{"id": "bird06"}],
            }
        }

        (data_dir / "regions.json").write_text(json.dumps(regions))
        (data_dir / "birds.json").write_text(json.dumps(birds))
        (data_dir / "history.json").write_text("{}")
        (data_dir / "daily.json").write_text(
            json.dumps(prior_daily if prior_daily is not None else [])
        )
        (root / "subregions.json").write_text(json.dumps(subregions))
        return data_dir

    def test_main_generates_daily_and_history(self, tmp_path, monkeypatch):
        """Test that main() produces valid daily.json/history.json end to end"""
        self._write_data_dir(tmp_path)
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "generate-daily-birds.py",
                "--date",
                "2026-08-06",
                "--subregions",
                "subregions.json",
                "--days",
                "7",
            ],
        )

        generate_daily_birds.main()

        daily = json.loads((tmp_path / "public/data/daily.json").read_text())
        history = json.loads((tmp_path / "public/data/history.json").read_text())

        # Both regions get entries for the rolling window [D-1, D, D+1]
        assert {e["region"] for e in daily} == {"us", "us-lower48"}
        assert {e["date"] for e in daily} == {
            "2026-08-05",
            "2026-08-06",
            "2026-08-07",
        }
        # Entries carry the additive id and an 8-char hash
        for entry in daily:
            assert entry["id"]
            assert len(entry["answerHash"]) == 8
            assert entry["answerHash"] == generate_daily_birds.hash_bird_id(entry["id"])
        # Subregion selected for all; the virtual region never picks Alaska
        assert all("subregion" in e for e in daily)
        assert all(
            e["subregion"] != "Alaska" for e in daily if e["region"] == "us-lower48"
        )
        # History has the window's entries for both regions
        assert {"us", "us-lower48"} <= set(history.keys())
        assert all(
            any(e["date"] == "2026-08-06" for e in history[r])
            for r in ("us", "us-lower48")
        )

    def test_main_preserves_prior_daily_entries(self, tmp_path, monkeypatch):
        """Test that prior dates in daily.json are preserved (no overwrite)"""
        prior_daily = [
            {
                "date": "2026-08-05",
                "region": "us",
                "answerHash": "104c723e",
                "id": "amerob",
            }
        ]
        self._write_data_dir(tmp_path, prior_daily=prior_daily)
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "generate-daily-birds.py",
                "--date",
                "2026-08-06",
                "--subregions",
                "subregions.json",
            ],
        )

        generate_daily_birds.main()

        daily = json.loads((tmp_path / "public/data/daily.json").read_text())
        # Prior entry survives (us 08-05 is skipped, not regenerated),
        # missing window entries are added, no duplicates.
        assert {(e["region"], e["date"]) for e in daily} == {
            ("us", "2026-08-05"),
            ("us-lower48", "2026-08-05"),
            ("us", "2026-08-06"),
            ("us-lower48", "2026-08-06"),
            ("us", "2026-08-07"),
            ("us-lower48", "2026-08-07"),
        }
        # Canonical (date, region) ordering for stable output
        assert [e["date"] for e in daily] == [
            "2026-08-05",
            "2026-08-05",
            "2026-08-06",
            "2026-08-06",
            "2026-08-07",
            "2026-08-07",
        ]

    def test_main_rerun_same_date_does_not_duplicate(self, tmp_path, monkeypatch):
        """Test that re-running main() for the same date upserts, never duplicates"""
        self._write_data_dir(tmp_path)
        monkeypatch.chdir(tmp_path)
        argv = [
            "generate-daily-birds.py",
            "--date",
            "2026-08-06",
            "--subregions",
            "subregions.json",
        ]
        monkeypatch.setattr(sys, "argv", argv)
        generate_daily_birds.main()
        generate_daily_birds.main()

        daily = json.loads((tmp_path / "public/data/daily.json").read_text())
        history = json.loads((tmp_path / "public/data/history.json").read_text())

        # No duplicate (region, date) entries in daily.json
        keys = [(e["region"], e["date"]) for e in daily]
        assert len(keys) == len(set(keys))
        # Exactly one history entry per region for today (replaced, not appended)
        for region, entries in history.items():
            today_entries = [e for e in entries if e["date"] == "2026-08-06"]
            assert len(today_entries) == 1
            dates = [e["date"] for e in entries]
            assert len(dates) == len(set(dates))

    def test_main_invalid_date_exits(self, tmp_path, monkeypatch):
        """Test that an invalid --date exits non-zero"""
        self._write_data_dir(tmp_path)
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            sys, "argv", ["generate-daily-birds.py", "--date", "not-a-date"]
        )

        with pytest.raises(SystemExit) as exc_info:
            generate_daily_birds.main()
        assert exc_info.value.code == 1

    def test_main_defaults_to_today(self, tmp_path, monkeypatch):
        """Test that main() uses today's date when --date is omitted"""
        self._write_data_dir(tmp_path)
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            sys, "argv", ["generate-daily-birds.py", "--subregions", "subregions.json"]
        )

        generate_daily_birds.main()

        today_str = datetime.now().strftime("%Y-%m-%d")
        daily = json.loads((tmp_path / "public/data/daily.json").read_text())
        # Rolling window centered on today
        assert {e["date"] for e in daily} == {
            (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
            today_str,
            (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
        }

    def test_main_missing_subregions_file_warns(self, tmp_path, monkeypatch, capsys):
        """Test that a missing --subregions file warns and proceeds unfiltered"""
        self._write_data_dir(tmp_path)
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "generate-daily-birds.py",
                "--date",
                "2026-08-06",
                "--subregions",
                "does-not-exist.json",
            ],
        )

        generate_daily_birds.main()

        captured = capsys.readouterr()
        assert "not found, proceeding without subregion filtering" in captured.out
        daily = json.loads((tmp_path / "public/data/daily.json").read_text())
        assert all("subregion" not in e for e in daily)

    def test_main_skips_region_without_birds(self, tmp_path, monkeypatch, capsys):
        """Test that a region with no birds is skipped with a warning"""
        self._write_data_dir(tmp_path)
        data_dir = tmp_path / "public" / "data"
        regions = json.loads((data_dir / "regions.json").read_text())
        regions.append({"id": "empty-region", "name": "Empty Region"})
        (data_dir / "regions.json").write_text(json.dumps(regions))

        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "generate-daily-birds.py",
                "--date",
                "2026-08-06",
                "--subregions",
                "subregions.json",
            ],
        )

        generate_daily_birds.main()

        captured = capsys.readouterr()
        assert "No birds found for region empty-region" in captured.out
        daily = json.loads((tmp_path / "public/data/daily.json").read_text())
        assert all(e["region"] != "empty-region" for e in daily)


class TestCrossProcessDeterminism:
    """Cross-process determinism: output must not depend on PYTHONHASHSEED"""

    @staticmethod
    def _run_generator(data_root, hashseed):
        """Run the generator in a subprocess with a fixed PYTHONHASHSEED."""
        env = dict(os.environ)
        env["PYTHONHASHSEED"] = hashseed
        env["PYTHONPATH"] = scripts_dir + os.pathsep + env.get("PYTHONPATH", "")
        result = subprocess.run(
            [
                sys.executable,
                os.path.join(scripts_dir, "generate-daily-birds.py"),
                "--date",
                "2026-08-06",
                "--subregions",
                "subregions.json",
                "--days",
                "7",
            ],
            cwd=str(data_root),
            env=env,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        return (
            (data_root / "public/data/daily.json").read_text(),
            (data_root / "public/data/history.json").read_text(),
        )

    def test_identical_output_across_python_hash_seeds(self, tmp_path):
        """Test that different PYTHONHASHSEED values produce byte-identical output"""
        root_a = tmp_path / "run_a"
        root_b = tmp_path / "run_b"
        for root in (root_a, root_b):
            data_dir = root / "public" / "data"
            data_dir.mkdir(parents=True)
            regions = [
                {"id": "us", "name": "United States"},
                {
                    "id": "us-lower48",
                    "name": "US Lower 48",
                    "parentRegion": "us",
                    "excludedSubregions": ["Alaska"],
                },
            ]
            birds = {
                "us": [
                    {"id": f"bird{i:02d}", "name": f"Bird {i:02d}"}
                    for i in range(1, 11)
                ]
            }
            subregions = {
                "us": {
                    "California": [
                        {"id": "bird01"},
                        {"id": "bird02"},
                        {"id": "bird03"},
                    ],
                    "Texas": [{"id": "bird04"}, {"id": "bird05"}],
                    "Alaska": [{"id": "bird06"}],
                }
            }
            (data_dir / "regions.json").write_text(json.dumps(regions))
            (data_dir / "birds.json").write_text(json.dumps(birds))
            (data_dir / "history.json").write_text("{}")
            (data_dir / "daily.json").write_text("[]")
            (root / "subregions.json").write_text(json.dumps(subregions))

        daily_a, history_a = self._run_generator(root_a, "0")
        daily_b, history_b = self._run_generator(root_b, "12345")

        # Byte-identical outputs across processes with different hash seeds
        assert daily_a == daily_b
        assert history_a == history_b

        # The same (region, date) selects the same subregion and bird
        parsed_a = json.loads(daily_a)
        parsed_b = json.loads(daily_b)
        for entry_a, entry_b in zip(parsed_a, parsed_b):
            assert entry_a["region"] == entry_b["region"]
            assert entry_a["answerHash"] == entry_b["answerHash"]
            assert entry_a.get("subregion") == entry_b.get("subregion")
        # Subregion selection actually happened (guards against a trivial pass)
        assert any("subregion" in e for e in parsed_a)
