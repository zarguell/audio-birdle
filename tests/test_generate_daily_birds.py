"""Tests for generate-daily-birds.py script"""

import pytest
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, mock_open
import tempfile

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

    def test_hash_bird_id(self):
        """Test basic hashing functionality"""
        hash_result = generate_daily_birds.hash_bird_id("amerob")

        assert isinstance(hash_result, str)
        assert len(hash_result) == 8
        assert all(c in "0123456789abcdef" for c in hash_result)

    def test_hash_consistency(self):
        """Test that hashing is consistent"""
        hash1 = generate_daily_birds.hash_bird_id("amerob")
        hash2 = generate_daily_birds.hash_bird_id("amerob")

        assert hash1 == hash2

    def test_hash_uniqueness(self):
        """Test that different IDs produce different hashes"""
        hash1 = generate_daily_birds.hash_bird_id("amerob")
        hash2 = generate_daily_birds.hash_bird_id("barswa")

        assert hash1 != hash2

    def test_hash_lowercase(self):
        """Test that hash is lowercase"""
        hash_result = generate_daily_birds.hash_bird_id("TESTBIRD")

        assert hash_result == hash_result.lower()


class TestLoadJsonFile:
    """Test JSON loading with error handling"""

    def test_load_valid_json(self, tmp_path):
        """Test loading a valid JSON file"""
        test_data = {"test": "data"}
        test_file = tmp_path / "test.json"
        test_file.write_text(json.dumps(test_data))

        result = generate_daily_birds.load_json_file(str(test_file))

        assert result == test_data

    def test_load_nonexistent_history_file(self, tmp_path, capsys):
        """Test that non-existent history file returns empty dict"""
        result = generate_daily_birds.load_json_file(str(tmp_path / "history.json"))

        captured = capsys.readouterr()
        assert "Warning:" in captured.out
        assert result == {}

    def test_load_nonexistent_other_file(self, tmp_path, capsys):
        """Test that non-existent non-history file returns empty list"""
        result = generate_daily_birds.load_json_file(str(tmp_path / "birds.json"))

        assert result == []

    def test_load_invalid_json(self, tmp_path):
        """Test handling of invalid JSON"""
        invalid_file = tmp_path / "invalid.json"
        invalid_file.write_text("{ invalid json }")

        with pytest.raises(SystemExit):
            generate_daily_birds.load_json_file(str(invalid_file))

    def test_load_empty_json(self, tmp_path):
        """Test loading empty JSON object"""
        empty_file = tmp_path / "empty.json"
        empty_file.write_text("{}")

        result = generate_daily_birds.load_json_file(str(empty_file))

        assert result == {}


class TestGetRecentAnswers:
    """Test recent answer retrieval"""

    def test_get_recent_answers_empty_history(self):
        """Test with empty history"""
        history = {}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 30, current_date
        )

        assert recent == set()

    def test_get_recent_answers_within_window(self, sample_history_data):
        """Test getting answers within the time window"""
        history = {"us": sample_history_data}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 10, current_date
        )

        # "amerob" was on 2025-12-25 (2 days ago) - should be included
        assert "amerob" in recent

    def test_get_recent_answers_outside_window(self, sample_history_data):
        """Test that old answers are excluded"""
        old_history = [{"date": "2025-11-01", "id": "oldbird", "subregion": "New York"}]
        history = {"us": old_history}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 30, current_date
        )

        assert "oldbird" not in recent

    def test_get_recent_answers_no_region_history(self):
        """Test with non-existent region"""
        history = {"eu": [{"date": "2025-12-26", "id": "eurbird"}]}
        current_date = datetime(2025, 12, 27).date()
        recent = generate_daily_birds.get_recent_answers(
            history, "us", 30, current_date
        )

        assert recent == set()


class TestGetSubregionForDate:
    """Test subregion selection for date"""

    def test_get_subregion_no_subregions_data(self):
        """Test with no subregions data"""
        result = generate_daily_birds.get_subregion_for_date(
            {}, "us", datetime(2025, 12, 27).date()
        )

        assert result == (None, [])

    def test_get_subregion_empty_region(self):
        """Test with empty region data"""
        data = {"us": {}}
        result = generate_daily_birds.get_subregion_for_date(
            data, "us", datetime(2025, 12, 27).date()
        )

        assert result == (None, [])

    def test_get_subregion_selects_valid_subregion(self):
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

    def test_get_subregion_deterministic(self):
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

    def test_filter_birds_by_subregion_ids(self):
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

    def test_filter_empty_birds_list(self):
        """Test filtering empty birds list"""
        result = generate_daily_birds.filter_birds_by_subregion([], {"bird1"})

        assert result == []

    def test_filter_empty_subregion_ids(self):
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

    def test_save_json_file(self, tmp_path):
        """Test saving data to JSON file"""
        test_data = {"key": "value"}
        output_file = tmp_path / "output.json"

        generate_daily_birds.save_json_file(str(output_file), test_data)

        assert output_file.exists()
        with open(output_file) as f:
            saved_data = json.load(f)
        assert saved_data == test_data

    def test_save_json_with_complex_data(self, tmp_path):
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
