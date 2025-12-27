import pytest
import json
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, patch
import sys

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

@pytest.fixture
def sample_taxonomy_data():
    """Sample taxonomy data for testing"""
    return [
        {
            "speciesCode": "amerob",
            "comName": "American Robin",
            "sciName": "Turdus migratorius",
            "order": "Passeriformes",
            "familyComName": "Turdidae",
            "familySciName": "Turdidae"
        },
        {
            "speciesCode": "barswa",
            "comName": "Barn Swallow",
            "sciName": "Hirundo rustica",
            "order": "Passeriformes",
            "familyComName": "Hirundinidae",
            "familySciName": "Hirundinidae"
        }
    ]

@pytest.fixture
def sample_urls_data():
    """Sample URLs data for testing"""
    return [
        {"code": "amerob", "audio Url": "https://example.com/robin1.mp3"},
        {"code": "amerob", "audio Url": "https://example.com/robin2.mp3"},
        {"code": "barswa", "audio Url": "https://example.com/swallow1.mp3"}
    ]

@pytest.fixture
def sample_birds_data():
    """Sample birds data matching the application format"""
    return {
        "us": [
            {
                "id": "amerob",
                "name": "American Robin",
                "scientificName": "Turdus migratorius",
                "order": "Passeriformes",
                "family": "Turdidae (Turdidae)",
                "audioUrl": ["https://example.com/robin1.mp3", "https://example.com/robin2.mp3"]
            },
            {
                "id": "barswa",
                "name": "Barn Swallow",
                "scientificName": "Hirundo rustica",
                "order": "Passeriformes",
                "family": "Hirundinidae (Hirundinidae)",
                "audioUrl": ["https://example.com/swallow1.mp3"]
            }
        ]
    }

@pytest.fixture
def sample_regions_data():
    """Sample regions data"""
    return [
        {"id": "us", "name": "United States"},
        {"id": "eu", "name": "Europe"}
    ]

@pytest.fixture
def temp_json_file(sample_taxonomy_data):
    """Create a temporary JSON file for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(sample_taxonomy_data, f)
        temp_path = f.name

    yield temp_path

    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)

@pytest.fixture
def mock_env_vars():
    """Mock environment variables"""
    with patch.dict(os.environ, {'EBIRD_API_KEY': 'test-api-key'}):
        yield

@pytest.fixture
def sample_daily_data():
    """Sample daily.json data"""
    return [
        {
            "date": "2025-12-27",
            "region": "us",
            "answerHash": "a1b2c3d4"
        }
    ]

@pytest.fixture
def sample_history_data():
    """Sample history.json data"""
    return {
        "us": [
            {"date": "2025-12-26", "id": "barswa", "subregion": "California"},
            {"date": "2025-12-25", "id": "amerob", "subregion": "New York"}
        ]
    }
