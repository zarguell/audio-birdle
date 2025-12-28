"""Tests for generate-daily-region-data.py script"""

import pytest
import json
import os
import sys
from unittest.mock import patch, MagicMock
import tempfile

# Import the module
scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, scripts_dir)

import importlib.util

spec = importlib.util.spec_from_file_location(
    "generate_daily_region_data",
    os.path.join(scripts_dir, "generate-daily-region-data.py"),
)
generate_daily_region_data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_daily_region_data)


class TestModuleStructure:
    """Test basic module structure and imports"""

    @staticmethod
    def test_module_has_main_function():
        """Test that the module has a main function"""
        assert hasattr(generate_daily_region_data, "main")

    @staticmethod
    def test_module_imports_required_libraries():
        """Test that required libraries are imported"""
        # Check if common libraries are accessible
        assert "json" in sys.modules
        assert "os" in sys.modules


class TestMainFunctionality:
    """Test main function with mocked dependencies"""

    @staticmethod
    def test_main_requires_api_key(tmp_path, capsys):
        """Test that main fails without API key"""
        subregions_file = tmp_path / "test-subregions.json"
        output_file = tmp_path / "output.json"
        subregions_file.write_text(json.dumps([]))

        # Mock environment to not have API key
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError) as exc_info:
                generate_daily_region_data.main()

            assert "EBIRD_API_KEY" in str(exc_info.value)

    @staticmethod
    def test_main_fails_with_empty_subregions(tmp_path):
        """Test that main fails with empty subregions list"""
        subregions_file = tmp_path / "test-subregions.json"
        output_file = tmp_path / "output.json"
        subregions_file.write_text(json.dumps([]))

        test_args = [
            "generate-daily-region-data.py",
            str(subregions_file),
            str(output_file),
        ]

        with patch.dict(os.environ, {"EBIRD_API_KEY": "test-key"}):
            with patch("sys.argv", test_args):
                with pytest.raises(ValueError) as exc_info:
                    generate_daily_region_data.main()

                assert "empty" in str(exc_info.value).lower()

    @patch("requests.get")
    @patch.dict(os.environ, {"EBIRD_API_KEY": "test-key"})
    def test_main_successful_flow(self, mock_get, tmp_path):
        """Test successful execution flow"""
        # Setup test data
        subregions_data = [{"code": "US-NY", "name": "New York"}]
        subregions_file = tmp_path / "us-subregions.json"
        output_file = tmp_path / "output.json"
        subregions_file.write_text(json.dumps(subregions_data))

        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"speciesCode": "amerob"},
            {"speciesCode": "barswa"},
            {"speciesCode": "amerob"},  # Duplicate
        ]
        mock_get.return_value = mock_response

        # Mock sys.argv
        test_args = [
            "generate-daily-region-data.py",
            str(subregions_file),
            str(output_file),
        ]

        with patch("sys.argv", test_args):
            with patch("random.choice", return_value=subregions_data[0]):
                generate_daily_region_data.main()

        # Verify output file was created
        assert output_file.exists()

        # Verify output structure
        with open(output_file) as f:
            output_data = json.load(f)

        assert "us" in output_data
        assert "New York" in output_data["us"]
        assert len(output_data["us"]["New York"]) == 2  # Unique species only

    @patch("requests.get")
    @patch.dict(os.environ, {"EBIRD_API_KEY": "test-key"})
    def test_main_handles_api_error(self, mock_get, tmp_path):
        """Test handling of API errors"""
        subregions_data = [{"code": "US-NY", "name": "New York"}]
        subregions_file = tmp_path / "us-subregions.json"
        output_file = tmp_path / "output.json"
        subregions_file.write_text(json.dumps(subregions_data))

        # Mock API error response
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_get.return_value = mock_response

        test_args = [
            "generate-daily-region-data.py",
            str(subregions_file),
            str(output_file),
        ]

        with patch("sys.argv", test_args):
            with patch("random.choice", return_value=subregions_data[0]):
                with pytest.raises(RuntimeError) as exc_info:
                    generate_daily_region_data.main()

                assert "Failed to fetch" in str(exc_info.value)

    @patch("requests.get")
    @patch.dict(os.environ, {"EBIRD_API_KEY": "test-key"})
    def test_main_extracts_unique_species(self, mock_get, tmp_path):
        """Test that duplicate species codes are removed"""
        subregions_data = [{"code": "US-NY", "name": "New York"}]
        subregions_file = tmp_path / "us-subregions.json"
        output_file = tmp_path / "output.json"
        subregions_file.write_text(json.dumps(subregions_data))

        # Mock response with duplicates
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"speciesCode": "bird1"},
            {"speciesCode": "bird2"},
            {"speciesCode": "bird1"},
            {"speciesCode": "bird3"},
            {"speciesCode": "bird2"},
        ]
        mock_get.return_value = mock_response

        test_args = [
            "generate-daily-region-data.py",
            str(subregions_file),
            str(output_file),
        ]

        with patch("sys.argv", test_args):
            with patch("random.choice", return_value=subregions_data[0]):
                generate_daily_region_data.main()

        with open(output_file) as f:
            output_data = json.load(f)

        species_ids = [item["id"] for item in output_data["us"]["New York"]]
        assert len(species_ids) == 3  # Only unique IDs
        assert species_ids == sorted(species_ids)  # Should be sorted


class TestRegionInference:
    """Test region code inference from filename"""

    @staticmethod
    def test_infers_region_from_filename(tmp_path):
        """Test that region is inferred from subregions filename"""
        # Create test subregions file
        subregions_data = [{"code": "TEST-01", "name": "Test Region"}]
        subregions_file = tmp_path / "us-subregions.json"
        subregions_file.write_text(json.dumps(subregions_data))

        # Extract region prefix using the same logic as the script
        region_prefix = os.path.basename(subregions_file).split("-")[0].lower()

        assert region_prefix == "us"

    @staticmethod
    def test_handles_different_region_formats(tmp_path):
        """Test handling various filename formats"""
        test_cases = [
            ("us-subregions.json", "us"),
            ("eu-subregions.json", "eu"),
            ("custom-subregions.json", "custom"),
        ]

        for filename, expected_region in test_cases:
            filepath = tmp_path / filename
            region_prefix = os.path.basename(filepath).split("-")[0].lower()
            assert region_prefix == expected_region


class TestOutputStructure:
    """Test output data structure"""

    @patch("requests.get")
    @patch.dict(os.environ, {"EBIRD_API_KEY": "test-key"})
    def test_output_structure_matches_expected_format(self, mock_get, tmp_path):
        """Test that output has correct structure"""
        subregions_data = [{"code": "US-NY", "name": "New York"}]
        subregions_file = tmp_path / "us-subregions.json"
        output_file = tmp_path / "output.json"
        subregions_file.write_text(json.dumps(subregions_data))

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"speciesCode": "bird1"}]
        mock_get.return_value = mock_response

        test_args = [
            "generate-daily-region-data.py",
            str(subregions_file),
            str(output_file),
        ]

        with patch("sys.argv", test_args):
            with patch("random.choice", return_value=subregions_data[0]):
                generate_daily_region_data.main()

        with open(output_file) as f:
            output_data = json.load(f)

        # Verify structure
        assert isinstance(output_data, dict)
        assert "us" in output_data
        assert isinstance(output_data["us"], dict)
        assert "New York" in output_data["us"]
        assert isinstance(output_data["us"]["New York"], list)

        # Verify bird entry structure
        bird_entry = output_data["us"]["New York"][0]
        assert "id" in bird_entry
        assert isinstance(bird_entry["id"], str)
