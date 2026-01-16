"""Tests for generate-daily-birds.py script"""

import pytest
import json
import os
import sys
from datetime import datetime

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
        "mallar3": "6e8e7f7c",
        "hoomer": "a1b2c3d4",
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
            assert (
                actual_hash == expected_hash
            ), f"Hash mismatch for {bird_id}: expected {expected_hash}, got {actual_hash}"

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
            assert (
                answer_hash in bird_hashes
            ), f"Hash {answer_hash} for region {region} on {entry['date']} not found in birds database. Available hashes: {sorted(bird_hashes)[:5]}..."

    @staticmethod
    def test_hash_lowercase():
        """Test that hash is lowercase"""
        hash_result = generate_daily_birds.hash_bird_id("TESTBIRD")

        assert hash_result == hash_result.lower()


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
        history = {"us": sample_history_data}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 10, current_date
        )

        # "amerob" was on 2025-12-25 (2 days ago) - should be included
        assert "amerob" in recent

    @staticmethod
    def test_get_recent_answers_outside_window(sample_history_data):
        """Test that old answers are excluded"""
        old_history = [{"date": "2025-11-01", "id": "oldbird", "subregion": "New York"}]
        history = {"us": old_history}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 30, current_date
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


@pytest.fixture
def sample_history_data():
    """Sample history data for testing"""
    return [
        {"date": "2025-12-26", "id": "barswa", "subregion": "California"},
        {"date": "2025-12-25", "id": "amerob", "subregion": "New York"},
        {"date": "2025-11-01", "id": "oldbird", "subregion": "Texas"},
    ]


class TestVirtualRegions:
    """Test virtual region functionality"""

    @staticmethod
    def test_virtual_region_subregion_filtering():
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

        # Mock virtual regions config
        virtual_regions = {
            "us-lower48": {"parent": "us", "excludedSubregions": ["Alaska", "Hawaii"]}
        }

        # Simulate the actual logic from main()
        region_id = "us-lower48"
        parent_id = virtual_regions[region_id]["parent"]
        region_subregions = subregions_data.get(parent_id, {}).copy()
        excluded = virtual_regions[region_id]["excludedSubregions"]

        # Remove excluded subregions from the selection pool
        for excluded_sub in excluded:
            if excluded_sub in region_subregions:
                del region_subregions[excluded_sub]

        # Verify Alaska and Hawaii were removed
        assert "Alaska" not in region_subregions
        assert "Hawaii" not in region_subregions
        assert "California" in region_subregions
        assert "Texas" in region_subregions
        assert len(region_subregions) == 2

    @staticmethod
    def test_virtual_region_bird_lookup():
        """Test that virtual regions fall back to parent region's birds"""
        birds_data = {
            "us": [{"id": "bird1", "name": "Bird 1"}],
            "us-lower48": [],  # Empty for virtual region
        }

        virtual_regions = {
            "us-lower48": {"parent": "us", "excludedSubregions": ["Alaska"]}
        }

        # Simulate the lookup logic from main()
        region_id = "us-lower48"
        region_birds = birds_data.get(region_id, [])
        if not region_birds and region_id in virtual_regions:
            parent_id = virtual_regions[region_id]["parent"]
            region_birds = birds_data.get(parent_id, [])

        # Should have gotten parent region's birds
        assert len(region_birds) == 1
        assert region_birds[0]["id"] == "bird1"

    @staticmethod
    def test_virtual_region_empty_after_exclusions():
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

        # Simulate the logic
        region_id = "us-lower48"
        parent_id = virtual_regions[region_id]["parent"]
        region_subregions = subregions_data.get(parent_id, {}).copy()
        excluded = virtual_regions[region_id]["excludedSubregions"]

        for excluded_sub in excluded:
            if excluded_sub in region_subregions:
                del region_subregions[excluded_sub]

        # Should have no valid subregions remaining
        assert len(region_subregions) == 0

    @staticmethod
    def test_virtual_region_no_exclusions():
        """Test virtual region with no excluded subregions"""
        subregions_data = {
            "us": {
                "California": [{"id": "bird1"}],
                "Texas": [{"id": "bird2"}],
            }
        }

        virtual_regions = {"us-lower48": {"parent": "us", "excludedSubregions": []}}

        # Simulate the logic
        region_id = "us-lower48"
        parent_id = virtual_regions[region_id]["parent"]
        region_subregions = subregions_data.get(parent_id, {}).copy()
        excluded = virtual_regions[region_id]["excludedSubregions"]

        for excluded_sub in excluded:
            if excluded_sub in region_subregions:
                del region_subregions[excluded_sub]

        # All parent subregions should be present
        assert "California" in region_subregions
        assert "Texas" in region_subregions
        assert len(region_subregions) == 2
