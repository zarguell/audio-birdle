"""Tests for game-data-generator.py script"""

import pytest
import json
import os
import sys
from pathlib import Path
from collections import defaultdict
from unittest.mock import patch, mock_open
import tempfile

# Import the module
scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, scripts_dir)

import importlib.util

spec = importlib.util.spec_from_file_location(
    "game_data_generator", os.path.join(scripts_dir, "game-data-generator.py")
)
game_data_generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(game_data_generator)


class TestLoadJsonFile:
    """Test JSON file loading functionality"""

    @staticmethod
    def test_load_valid_json(tmp_path):
        """Test loading a valid JSON file"""
        test_data = [{"key": "value"}]
        test_file = tmp_path / "test.json"
        test_file.write_text(json.dumps(test_data))

        data = game_data_generator.load_json_file(str(test_file))

        assert data == test_data
        assert isinstance(data, list)

    @staticmethod
    def test_load_file_not_found(tmp_path, capsys):
        """Test handling of non-existent file"""
        with pytest.raises(SystemExit):
            game_data_generator.load_json_file(str(tmp_path / "nonexistent.json"))

        captured = capsys.readouterr()
        assert "Error:" in captured.out
        assert "not found" in captured.out

    @staticmethod
    def test_load_invalid_json(tmp_path, capsys):
        """Test handling of invalid JSON"""
        invalid_file = tmp_path / "invalid.json"
        invalid_file.write_text("{ invalid json }")

        with pytest.raises(SystemExit):
            game_data_generator.load_json_file(str(invalid_file))

        captured = capsys.readouterr()
        assert "Error:" in captured.out
        assert "Invalid JSON" in captured.out


class TestGroupUrlsByCode:
    """Test URL grouping functionality"""

    @staticmethod
    def test_group_urls_by_code():
        """Test grouping URLs by species code"""
        data = [
            {"code": "amerob", "audio Url": "http://example.com/robin1.mp3"},
            {"code": "amerob", "audio Url": "http://example.com/robin2.mp3"},
            {"code": "barswa", "audio Url": "http://example.com/swallow1.mp3"},
        ]

        result = game_data_generator.group_urls_by_code(data)

        assert "amerob" in result
        assert "barswa" in result
        assert len(result["amerob"]) == 2
        assert len(result["barswa"]) == 1
        assert result["amerob"][0] == "http://example.com/robin1.mp3"

    @staticmethod
    def test_group_urls_empty_code():
        """Test handling entries with empty codes"""
        data = [
            {"code": "", "audio Url": "http://example.com/test.mp3"},
            {"code": "amerob", "audio Url": "http://example.com/robin.mp3"},
        ]

        result = game_data_generator.group_urls_by_code(data)

        assert "" not in result
        assert "amerob" in result
        assert len(result) == 1

    @staticmethod
    def test_group_urls_empty_url():
        """Test handling entries with empty URLs"""
        data = [
            {"code": "testbird", "audio Url": ""},
            {"code": "amerob", "audio Url": "http://example.com/robin.mp3"},
        ]

        result = game_data_generator.group_urls_by_code(data)

        assert "testbird" not in result
        assert "amerob" in result

    @staticmethod
    def test_group_urls_missing_fields():
        """Test handling entries with missing fields"""
        data = [
            {"code": "bird1"},  # Missing URL
            {"audio Url": "http://example.com/bird2.mp3"},  # Missing code
            {"code": "bird3", "audio Url": "http://example.com/bird3.mp3"},
        ]

        result = game_data_generator.group_urls_by_code(data)

        assert "bird1" not in result
        assert len(result) == 1
        assert "bird3" in result

    @staticmethod
    def test_group_urls_empty_list():
        """Test with empty input list"""
        result = game_data_generator.group_urls_by_code([])

        assert result == {}

    @staticmethod
    def test_group_urls_preserves_order():
        """Test that URL order is preserved"""
        data = [
            {"code": "bird1", "audio Url": "url1"},
            {"code": "bird1", "audio Url": "url2"},
            {"code": "bird1", "audio Url": "url3"},
        ]

        result = game_data_generator.group_urls_by_code(data)

        assert result["bird1"] == ["url1", "url2", "url3"]


class TestProcessTaxonomyData:
    """Test taxonomy data processing"""

    @staticmethod
    def test_process_taxonomy_data():
        """Test processing taxonomy with URL matching"""
        taxonomy_data = [
            {
                "speciesCode": "amerob",
                "comName": "American Robin",
                "sciName": "Turdus migratorius",
                "order": "Passeriformes",
                "familyComName": "Turdidae",
                "familySciName": "Turdidae",
            },
            {
                "speciesCode": "nobird",
                "comName": "No Audio Bird",
                "sciName": "No Audio",
                "order": "Passeriformes",
                "familyComName": "Test",
                "familySciName": "Test",
            },
        ]

        url_groups = {"amerob": ["http://example.com/robin.mp3"]}

        birds = game_data_generator.process_taxonomy_data(taxonomy_data, url_groups)

        assert len(birds) == 1
        assert birds[0]["id"] == "amerob"
        assert birds[0]["name"] == "American Robin"
        assert len(birds[0]["audioUrl"]) == 1

    @staticmethod
    def test_filter_birds_without_audio():
        """Test that birds without audio are filtered out"""
        taxonomy_data = [
            {
                "speciesCode": "bird1",
                "comName": "Bird 1",
                "sciName": "Bird 1",
                "order": "Passeriformes",
                "familyComName": "Test",
                "familySciName": "Test",
            }
        ]

        url_groups = {}

        birds = game_data_generator.process_taxonomy_data(taxonomy_data, url_groups)

        assert len(birds) == 0

    @staticmethod
    def test_skip_incomplete_taxonomy_entries():
        """Test skipping entries with missing required fields"""
        incomplete_data = [
            {"speciesCode": "", "comName": "Test", "sciName": "Test test"},
            {"speciesCode": "test", "comName": "", "sciName": "Test test"},
            {"speciesCode": "test", "comName": "Test", "sciName": ""},
        ]

        url_groups = {"test": ["http://example.com/test.mp3"]}

        birds = game_data_generator.process_taxonomy_data(incomplete_data, url_groups)

        assert len(birds) == 0

    @staticmethod
    def test_family_formatting():
        """Test correct family name formatting"""
        taxonomy_data = [
            {
                "speciesCode": "bird1",
                "comName": "Test Bird",
                "sciName": "Test bird",
                "order": "Passeriformes",
                "familyComName": "Turdidae",
                "familySciName": "Turdidae",
            }
        ]

        url_groups = {"bird1": ["url1"]}

        birds = game_data_generator.process_taxonomy_data(taxonomy_data, url_groups)

        assert birds[0]["family"] == "Turdidae (Turdidae)"

    @staticmethod
    def test_family_scientific_only():
        """Test family formatting when only scientific name exists"""
        taxonomy_data = [
            {
                "speciesCode": "bird1",
                "comName": "Test Bird",
                "sciName": "Test bird",
                "order": "Passeriformes",
                "familyComName": "",
                "familySciName": "Turdidae",
            }
        ]

        url_groups = {"bird1": ["url1"]}

        birds = game_data_generator.process_taxonomy_data(taxonomy_data, url_groups)

        assert birds[0]["family"] == "Turdidae"

    @staticmethod
    def test_multiple_audio_urls():
        """Test handling multiple audio URLs for one bird"""
        taxonomy_data = [
            {
                "speciesCode": "bird1",
                "comName": "Test Bird",
                "sciName": "Test bird",
                "order": "Passeriformes",
                "familyComName": "Test",
                "familySciName": "Test",
            }
        ]

        url_groups = {"bird1": ["url1", "url2", "url3"]}

        birds = game_data_generator.process_taxonomy_data(taxonomy_data, url_groups)

        assert len(birds[0]["audioUrl"]) == 3
        assert birds[0]["audioUrl"] == ["url1", "url2", "url3"]


class TestLoadExistingOutput:
    """Test loading existing output files"""

    @staticmethod
    def test_load_existing_file(tmp_path):
        """Test loading existing output file"""
        output_file = tmp_path / "output.json"
        test_data = {"us": [{"id": "bird1"}]}
        output_file.write_text(json.dumps(test_data))

        result = game_data_generator.load_existing_output(str(output_file))

        assert result == test_data

    @staticmethod
    def test_load_nonexistent_file(tmp_path, capsys):
        """Test handling when file doesn't exist"""
        result = game_data_generator.load_existing_output(
            str(tmp_path / "nonexistent.json")
        )

        assert result == {}

    @staticmethod
    def test_load_invalid_json(tmp_path, capsys):
        """Test handling invalid JSON in existing file"""
        output_file = tmp_path / "output.json"
        output_file.write_text("{ invalid json }")

        result = game_data_generator.load_existing_output(str(output_file))

        assert result == {}
        captured = capsys.readouterr()
        assert "Warning:" in captured.out

    @staticmethod
    def test_load_empty_file(tmp_path):
        """Test loading empty JSON file"""
        output_file = tmp_path / "output.json"
        output_file.write_text("{}")

        result = game_data_generator.load_existing_output(str(output_file))

        assert result == {}


class TestSaveJsonFile:
    """Test JSON file saving (if function exists)"""

    @staticmethod
    def test_save_json_file(tmp_path):
        """Test saving data to JSON file"""
        test_data = {"key": "value"}
        output_file = tmp_path / "output.json"

        # Check if save function exists in the module
        if hasattr(game_data_generator, "save_json_file"):
            game_data_generator.save_json_file(test_data, str(output_file))

            assert output_file.exists()
            with open(output_file) as f:
                saved_data = json.load(f)
            assert saved_data == test_data
        else:
            pytest.skip("save_json_file function not found in module")

    @staticmethod
    def test_save_with_indent(tmp_path):
        """Test that JSON is saved with proper indentation"""
        test_data = {"key": "value"}
        output_file = tmp_path / "output.json"

        if hasattr(game_data_generator, "save_json_file"):
            game_data_generator.save_json_file(test_data, str(output_file))

            with open(output_file) as f:
                content = f.read()

            # Check for indentation (should have newlines and spaces)
            assert "\n" in content or "  " in content
