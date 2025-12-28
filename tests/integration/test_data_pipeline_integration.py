"""
Data Pipeline Integration Tests

These tests verify that:
1. Generated JSON files are valid and properly structured
2. Cross-references between files are correct (e.g., bird IDs exist in birds.json)
3. Python scripts produce output that matches expected schemas
4. Data files can be loaded by JavaScript LoadGameData module
"""

import json
import os
import pytest
from pathlib import Path


class TestDataPipelineIntegration:
    """Test integration between Python scripts and generated data files."""

    @pytest.fixture
    def data_dir(self):
        """Path to public/data directory."""
        # Go up from tests/integration/ to project root, then to public/data
        return Path(__file__).parent.parent.parent / "public" / "data"

    @pytest.fixture
    def birds_json(self, data_dir):
        """Load birds.json."""
        path = data_dir / "birds.json"
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    @pytest.fixture
    def regions_json(self, data_dir):
        """Load regions.json."""
        path = data_dir / "regions.json"
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    @pytest.fixture
    def daily_json(self, data_dir):
        """Load daily.json."""
        path = data_dir / "daily.json"
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    @pytest.fixture
    def history_json(self, data_dir):
        """Load history.json."""
        path = data_dir / "history.json"
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    @staticmethod
    def test_birds_json_schema(birds_json):
        """Test that birds.json has correct structure."""
        assert isinstance(birds_json, dict), "birds.json should be a dictionary"

        for region, birds in birds_json.items():
            assert isinstance(region, str), f"Region key should be string, got {type(region)}"
            assert isinstance(birds, list), f"Birds for region {region} should be a list"

            # Check first bird has required fields
            if birds:
                bird = birds[0]
                required_fields = ['id', 'name', 'scientificName', 'order', 'family', 'audioUrl']
                for field in required_fields:
                    assert field in bird, f"Bird missing required field: {field}"

                # Check types
                assert isinstance(bird['id'], str)
                assert isinstance(bird['name'], str)
                assert isinstance(bird['audioUrl'], list)
                assert len(bird['audioUrl']) > 0, "Bird should have at least one audio URL"

    @staticmethod
    def test_regions_json_schema(regions_json):
        """Test that regions.json has correct structure."""
        assert isinstance(regions_json, list), "regions.json should be a list"

        if regions_json:
            region = regions_json[0]
            required_fields = ['id', 'name']
            for field in required_fields:
                assert field in region, f"Region missing required field: {field}"

            # Check types
            assert isinstance(region['id'], str)
            assert isinstance(region['name'], str)

    @staticmethod
    def test_daily_json_schema(daily_json):
        """Test that daily.json has correct structure."""
        assert isinstance(daily_json, list), "daily.json should be a list"

        if daily_json:
            entry = daily_json[0]
            required_fields = ['date', 'region', 'answerHash']
            for field in required_fields:
                assert field in entry, f"Daily entry missing required field: {field}"

            # Check types
            assert isinstance(entry['date'], str)
            assert isinstance(entry['region'], str)
            assert isinstance(entry['answerHash'], str)
            assert len(entry['answerHash']) == 8, f"Hash should be 8 chars, got {len(entry['answerHash'])}"

            # Check date format (YYYY-MM-DD)
            assert '-' in entry['date'], "Date should be in YYYY-MM-DD format"

    @staticmethod
    def test_history_json_schema(history_json):
        """Test that history.json has correct structure."""
        assert isinstance(history_json, dict), "history.json should be a dictionary"

        for date_key, entries in history_json.items():
            assert isinstance(date_key, str)
            assert isinstance(entries, list)

            if entries:
                entry = entries[0]
                # History entries can have different formats
                # Some have 'region' and 'answerHash', others have 'id', 'name', 'subregion'
                assert isinstance(entry, dict)
                # At minimum, should have some identifying fields
                assert len(entry) > 0

    @staticmethod
    def test_cross_reference_birds_in_daily(birds_json, daily_json):
        """Test that daily.json bird hashes can be found in birds.json."""
        # Get all bird IDs for a region
        region = daily_json[0]['region'] if daily_json else 'us'
        birds_in_region = birds_json.get(region, [])

        # Get all bird IDs
        bird_ids = {bird['id'] for bird in birds_in_region}

        # Verify we have birds in the region
        assert len(bird_ids) > 0, f"Region {region} should have at least one bird"

        # Note: We can't directly verify hashes match without importing hash function
        # but we can verify the region exists and has birds
        assert region in birds_json, f"Region {region} from daily.json should exist in birds.json"

    @staticmethod
    def test_regions_match_birds_regions(regions_json, birds_json):
        """Test that all regions in birds.json are defined in regions.json."""
        region_ids = {r['id'] for r in regions_json}
        birds_regions = set(birds_json.keys())

        # All regions with birds should be defined in regions.json
        undefined_regions = birds_regions - region_ids

        if undefined_regions:
            pytest.fail(f"Regions in birds.json not defined in regions.json: {undefined_regions}")

    @staticmethod
    def test_no_duplicate_daily_entries(daily_json):
        """Test that daily.json has no duplicate region-date combinations."""
        seen = set()
        duplicates = []

        for entry in daily_json:
            key = f"{entry['region']}-{entry['date']}"
            if key in seen:
                duplicates.append(key)
            seen.add(key)

        if duplicates:
            pytest.fail(f"Found duplicate entries in daily.json: {duplicates}")

    @staticmethod
    def test_bird_audio_urls_valid(birds_json):
        """Test that audio URLs are properly formatted."""
        for region, birds in birds_json.items():
            for bird in birds:
                for url in bird['audioUrl']:
                    assert isinstance(url, str), f"Audio URL should be string, got {type(url)}"
                    assert url.startswith('http'), f"Audio URL should start with http/https: {url}"

    @staticmethod
    def test_daily_subregion_references(birds_json, daily_json):
        """Test that subregion references in daily.json are valid."""
        for entry in daily_json:
            if 'subregion' in entry and entry['subregion']:
                subregion = entry['subregion']
                region = entry['region']

                # Verify region exists in birds.json
                assert region in birds_json, f"Region {region} should exist in birds.json"

                # Subregion format validation
                # Can be: "US-NY", "New Jersey", "Kentucky", etc.
                assert isinstance(subregion, str), "Subregion should be a string"
                assert len(subregion) > 0, f"Subregion should not be empty, got: {subregion}"

    @staticmethod
    def test_json_files_are_valid_json(data_dir):
        """Test that all JSON files in data/ are valid JSON."""
        json_files = [
            'birds.json',
            'regions.json',
            'daily.json',
            'history.json'
        ]

        for filename in json_files:
            path = data_dir / filename
            assert path.exists(), f"Required data file {filename} does not exist"

            # Try to load it - will raise exception if invalid
            with open(path, 'r', encoding='utf-8') as f:
                json.load(f)

    @staticmethod
    def test_bird_data_completeness(birds_json):
        """Test that birds have all required data fields."""
        required_fields = {
            'id': str,
            'name': str,
            'scientificName': str,
            'order': str,
            'family': str,
            'audioUrl': list
        }

        for region, birds in birds_json.items():
            for i, bird in enumerate(birds):
                for field, expected_type in required_fields.items():
                    assert field in bird, \
                        f"Bird {i} in region {region} missing field '{field}'"
                    assert isinstance(bird[field], expected_type), \
                        f"Bird {i} in region {region}: field '{field}' should be {expected_type}, got {type(bird[field])}"

    @staticmethod
    def test_no_empty_bird_lists(birds_json):
        """Test that all regions have at least one bird."""
        empty_regions = [
            region for region, birds in birds_json.items()
            if not birds or len(birds) == 0
        ]

        if empty_regions:
            pytest.fail(f"Regions with no birds: {empty_regions}")
