"""
Data Pipeline Integration Tests

These tests verify that:
1. Generated JSON files are valid and properly structured
2. Cross-references between files are correct (e.g., bird IDs exist in birds.json)
3. Python scripts produce output that matches expected schemas
4. Data files can be loaded by the static client data manifest
"""

import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

# Load hash_bird_id from generate-daily-birds.py (dashed filename, so we use
# importlib — the same approach the other Python tests use).
scripts_dir = os.path.join(Path(__file__).parent.parent.parent, "scripts")
spec = importlib.util.spec_from_file_location(
    "generate_daily_birds", os.path.join(scripts_dir, "generate-daily-birds.py")
)
generate_daily_birds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_daily_birds)


class TestDataPipelineIntegration:
    """Test integration between Python scripts and generated data files."""

    @pytest.fixture
    def data_dir(self):
        """Path to public/data directory."""
        # Go up from tests/integration/ to project root, then to public/data
        return Path(__file__).parent.parent.parent / "public" / "data"

    @pytest.fixture
    def birds_json(self, data_dir):
        """Load and aggregate the per-region bird shards."""
        birds = {}
        for path in sorted((data_dir / "birds").glob("*.json")):
            with open(path, "r", encoding="utf-8") as f:
                birds[path.stem] = json.load(f)
        return birds

    @pytest.fixture
    def regions_json(self, data_dir):
        """Load regions.json."""
        path = data_dir / "regions.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @pytest.fixture
    def daily_json(self, data_dir):
        """Load daily.json."""
        path = data_dir / "daily.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @pytest.fixture
    def daily_subregion_json(self, data_dir):
        """Load daily-subregion-birds.json."""
        path = data_dir / "daily-subregion-birds.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @pytest.fixture
    def history_json(self, data_dir):
        """Load history.json."""
        path = data_dir / "history.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def test_birds_json_schema(birds_json):
        """Test that birds.json has correct structure."""
        assert isinstance(birds_json, dict), "birds.json should be a dictionary"

        for region, birds in birds_json.items():
            assert isinstance(region, str), (
                f"Region key should be string, got {type(region)}"
            )
            assert isinstance(birds, list), (
                f"Birds for region {region} should be a list"
            )

            # Check first bird has required fields
            if birds:
                bird = birds[0]
                required_fields = [
                    "id",
                    "name",
                    "scientificName",
                    "order",
                    "family",
                    "audioUrl",
                ]
                for field in required_fields:
                    assert field in bird, f"Bird missing required field: {field}"

                # Check types
                assert isinstance(bird["id"], str)
                assert isinstance(bird["name"], str)
                assert isinstance(bird["audioUrl"], list)
                assert len(bird["audioUrl"]) > 0, (
                    "Bird should have at least one audio URL"
                )

    @staticmethod
    def test_regions_json_schema(regions_json):
        """Test that regions.json has correct structure."""
        assert isinstance(regions_json, list), "regions.json should be a list"

        if regions_json:
            region = regions_json[0]
            required_fields = ["id", "name"]
            for field in required_fields:
                assert field in region, f"Region missing required field: {field}"

            # Check types
            assert isinstance(region["id"], str)
            assert isinstance(region["name"], str)

    @staticmethod
    def test_daily_json_schema(daily_json):
        """Test that daily.json has correct structure."""
        assert isinstance(daily_json, list), "daily.json should be a list"

        if daily_json:
            entry = daily_json[0]
            required_fields = ["date", "region", "answerHash"]
            for field in required_fields:
                assert field in entry, f"Daily entry missing required field: {field}"

            # Check types
            assert isinstance(entry["date"], str)
            assert isinstance(entry["region"], str)
            assert isinstance(entry["answerHash"], str)
            assert len(entry["answerHash"]) == 8, (
                f"Hash should be 8 chars, got {len(entry['answerHash'])}"
            )

            # Check date format (YYYY-MM-DD)
            assert "-" in entry["date"], "Date should be in YYYY-MM-DD format"

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
    def test_cross_reference_birds_in_daily(birds_json, daily_json, regions_json):
        """Test that every daily.json answerHash corresponds to a bird in birds.json."""
        # Build region -> bird ids, resolving virtual regions to their parent
        virtual_regions = {
            r["id"]: r["parentRegion"] for r in regions_json if "parentRegion" in r
        }
        region_birds = {}
        for region, birds in birds_json.items():
            region_birds[region] = {bird["id"] for bird in birds}
        for region, parent in virtual_regions.items():
            region_birds.setdefault(region, region_birds.get(parent, set()))

        for entry in daily_json:
            region = entry["region"]
            bird_ids = region_birds.get(region, set())
            assert len(bird_ids) > 0, f"Region {region} should have at least one bird"

            # Compute the canonical hash for every bird in the region and make
            # sure the daily answerHash is one of them.
            valid_hashes = {
                generate_daily_birds.hash_bird_id(bird_id) for bird_id in bird_ids
            }
            assert entry["answerHash"] in valid_hashes, (
                f"Hash {entry['answerHash']} for region {region} on {entry['date']} "
                f"does not match any bird in birds.json"
            )

    @staticmethod
    def test_regions_match_birds_regions(regions_json, birds_json):
        """Test that all regions in birds.json are defined in regions.json."""
        region_ids = {r["id"] for r in regions_json}
        birds_regions = set(birds_json.keys())

        # All regions with birds should be defined in regions.json
        undefined_regions = birds_regions - region_ids

        if undefined_regions:
            pytest.fail(
                f"Regions in birds.json not defined in regions.json: {undefined_regions}"
            )

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
        """Test that audio URLs are properly formatted.

        Supports both the legacy format (array of URL strings) and the
        attributed format (array of {url, attribution} objects) that
        enhance-bird-data.py / game-data-generator.py emit and the
        frontend's getAudioSrc + sanitizeBird consume.
        """
        for region, birds in birds_json.items():
            for bird in birds:
                for entry in bird["audioUrl"]:
                    url = entry if isinstance(entry, str) else entry.get("url")
                    assert isinstance(url, str), (
                        f"Audio URL should be string, got {type(url)}"
                    )
                    assert url.startswith("http"), (
                        f"Audio URL should start with http/https: {url}"
                    )
                    if isinstance(entry, dict):
                        assert isinstance(entry.get("attribution", {}), dict)

    @staticmethod
    def test_bird_audio_urls_unique_and_https(birds_json):
        """Clip URLs must be unique globally and served over https."""
        seen = {}
        for region, birds in birds_json.items():
            for bird in birds:
                for entry in bird["audioUrl"]:
                    url = entry if isinstance(entry, str) else entry.get("url")
                    assert url.startswith("https"), f"Non-https URL: {url}"
                    if url in seen:
                        pytest.fail(
                            f"Duplicate clip URL {url} in "
                            f"{seen[url]} and {region}/{bird['id']}"
                        )
                    seen[url] = f"{region}/{bird['id']}"

    @staticmethod
    def test_daily_entries_have_consistent_ids(birds_json, daily_json):
        """Every daily entry must carry an id whose canonical hash matches
        answerHash (frontend bird lookup hashes ids, not names)."""
        hash_fn = generate_daily_birds.hash_bird_id
        for entry in daily_json:
            assert entry.get("id"), f"daily.json entry missing id: {entry}"
            assert hash_fn(entry["id"]) == entry["answerHash"], (
                f"id/answerHash mismatch for {entry['date']}/{entry['region']}: "
                f"{entry['id']} vs {entry['answerHash']}"
            )

    @staticmethod
    def test_daily_answer_hashes_resolve(birds_json, regions_json, daily_json):
        """Every answerHash must resolve to a bird in the region pool
        (virtual regions resolve against their parent's pool)."""
        parents = {r["id"]: r.get("parentRegion", r["id"]) for r in regions_json}
        pools = {}
        for region, birds in birds_json.items():
            pools[region] = {generate_daily_birds.hash_bird_id(b["id"]) for b in birds}
        for entry in daily_json:
            pool = pools.get(parents.get(entry["region"], entry["region"]), set())
            assert entry["answerHash"] in pool, (
                f"Unresolved answerHash {entry['answerHash']} for "
                f"{entry['date']}/{entry['region']}"
            )

    @staticmethod
    def test_lower48_daily_does_not_use_excluded_subregions(daily_json):
        """us-lower48 daily entries must never use Alaska/Hawaii subregions.

        Species-level exclusion is intentionally not checked here: the
        subregion lists are a current-season snapshot, so a species that is
        only in Hawaii today may legitimately appear in a past lower-48 entry
        from its migration season (for example Least Tern in September).
        """
        for entry in daily_json:
            if entry["region"] != "us-lower48":
                continue
            assert entry.get("subregion") not in {"Alaska", "Hawaii"}, (
                f"lower48 entry used excluded subregion: {entry}"
            )

    @staticmethod
    def test_au_subregions_are_subset_of_playable_birds(
        birds_json, daily_subregion_json
    ):
        """The country-level Australia pool must reference shipped AU birds."""
        au_ids = {bird["id"] for bird in birds_json["au"]}
        entries = daily_subregion_json["au"]["Australia"]
        refs = {entry["id"] for entry in entries}
        assert refs <= au_ids, "Australia pool references unplayable AU birds"
        assert len(refs) >= 10

    @staticmethod
    def test_au_daily_entries_come_from_regular_pool(daily_json):
        """AU daily answers must come from the year-round regular pool.

        AU deliberately ships no ``au-daily-regular-species.json``: that
        sibling file replaces the year-round pool for *every* season (no
        month key, no expiry, nothing regenerates it), which would retire a
        large share of the playable species from the daily rotation for good.
        Seasonality is handled by intersecting with today's eBird
        observations, so the annual pool is the correct filter.
        """
        regions_dir = Path(__file__).parent.parent.parent / "scripts" / "data"
        assert not (regions_dir / "regions" / "au-daily-regular-species.json").exists()
        regular = json.loads(
            (regions_dir / "regions" / "au-regular-species.json").read_text(
                encoding="utf-8"
            )
        )
        for entry in (item for item in daily_json if item["region"] == "au"):
            assert entry["id"] in regular["Australia"], (
                f"AU answer {entry['id']} is not in the regular pool"
            )

    @staticmethod
    def test_au_uses_current_taxonomy_split(birds_json):
        """AU should use the current eBird split code, not a legacy entry."""
        au_ids = {bird["id"] for bird in birds_json["au"]}
        assert "litshr31" in au_ids

    @staticmethod
    def test_ie_subregions_are_subset_of_playable_birds(
        birds_json, daily_subregion_json
    ):
        """The country-level Ireland pool must reference shipped IE birds."""
        ie_ids = {bird["id"] for bird in birds_json["ie"]}
        entries = daily_subregion_json["ie"]["Ireland"]
        refs = {entry["id"] for entry in entries}
        assert refs <= ie_ids, "Ireland pool references unplayable IE birds"
        assert len(refs) >= 10

    @staticmethod
    def test_ie_daily_entries_come_from_seasonal_pool(daily_json):
        """IE daily answers must be on the current seasonal filter."""
        path = (
            Path(__file__).parent.parent.parent
            / "scripts"
            / "data"
            / "regions"
            / "ie-daily-regular-species.json"
        )
        regular = json.loads(path.read_text(encoding="utf-8"))
        for entry in (item for item in daily_json if item["region"] == "ie"):
            assert entry["id"] in regular["Ireland"], (
                f"IE answer {entry['id']} is not in the seasonal pool"
            )

    @staticmethod
    def test_all_daily_subregions_are_playable(birds_json, daily_subregion_json):
        """Filtered regions must only reference shipped bird entries."""
        regions_dir = (
            Path(__file__).parent.parent.parent / "scripts" / "data" / "regions"
        )
        for region, groups in daily_subregion_json.items():
            if region not in birds_json:
                continue
            if not (regions_dir / f"{region}-regular-species.json").exists():
                continue
            ids = {bird["id"] for bird in birds_json[region]}
            for name, entries in groups.items():
                refs = {entry["id"] for entry in entries}
                assert refs <= ids, f"{region}/{name} references unplayable birds"

    @staticmethod
    def test_all_daily_entries_are_in_seasonal_filters(daily_json):
        """Regions with a daily seasonal filter must obey it."""
        regions_dir = (
            Path(__file__).parent.parent.parent / "scripts" / "data" / "regions"
        )
        for path in regions_dir.glob("*-daily-regular-species.json"):
            region = path.name.removesuffix("-daily-regular-species.json")
            mapping = json.loads(path.read_text(encoding="utf-8"))
            allowed = set().union(*(set(ids) for ids in mapping.values()))
            for entry in (item for item in daily_json if item["region"] == region):
                assert entry["id"] in allowed, (
                    f"{region} answer {entry['id']} is not in the seasonal pool"
                )

    @staticmethod
    def test_birds_have_facts_and_learn_more(birds_json):
        """Offline enhancements must survive regeneration: every bird ships
        with a non-empty fact and learnMoreUrl (enhance-bird-data.py)."""
        missing_facts = []
        missing_learn = []
        for region, birds in birds_json.items():
            for bird in birds:
                if not bird.get("facts"):
                    missing_facts.append(f"{region}/{bird['id']}")
                if not bird.get("learnMoreUrl"):
                    missing_learn.append(f"{region}/{bird['id']}")
        assert not missing_facts, f"Birds missing facts: {missing_facts[:5]}"
        assert not missing_learn, f"Birds missing learnMoreUrl: {missing_learn[:5]}"

    @staticmethod
    def test_daily_subregion_references(birds_json, daily_json, regions_json):
        """Test that subregion references in daily.json are valid."""
        # Build lookup of virtual regions and their parents
        virtual_regions = {}
        for region in regions_json:
            if "parentRegion" in region:
                virtual_regions[region["id"]] = region["parentRegion"]

        for entry in daily_json:
            if "subregion" in entry and entry["subregion"]:
                subregion = entry["subregion"]
                region = entry["region"]

                # Verify region exists in birds.json OR has a parent region
                region_exists = region in birds_json
                has_parent = region in virtual_regions

                assert region_exists or has_parent, (
                    f"Region {region} should exist in birds.json or have a parent region defined"
                )

                # Subregion format validation
                # Can be: "US-NY", "New Jersey", "Kentucky", etc.
                assert isinstance(subregion, str), "Subregion should be a string"
                assert len(subregion) > 0, (
                    f"Subregion should not be empty, got: {subregion}"
                )

    @staticmethod
    def test_json_files_are_valid_json(data_dir):
        """Test that all JSON files in data/ are valid JSON."""
        json_files = ["regions.json", "daily.json", "history.json"]
        paths = [data_dir / filename for filename in json_files]
        paths.extend(sorted((data_dir / "birds").glob("*.json")))

        for path in paths:
            assert path.exists(), f"Required data file {path.name} does not exist"

            # Try to load it - will raise exception if invalid
            with open(path, "r", encoding="utf-8") as f:
                json.load(f)

    @staticmethod
    def test_bird_data_completeness(birds_json):
        """Test that birds have all required data fields."""
        required_fields = {
            "id": str,
            "name": str,
            "scientificName": str,
            "order": str,
            "family": str,
            "audioUrl": list,
        }

        for region, birds in birds_json.items():
            for i, bird in enumerate(birds):
                for field, expected_type in required_fields.items():
                    assert field in bird, (
                        f"Bird {i} in region {region} missing field '{field}'"
                    )
                    assert isinstance(bird[field], expected_type), (
                        f"Bird {i} in region {region}: field '{field}' should be {expected_type}, got {type(bird[field])}"
                    )

    @staticmethod
    def test_no_empty_bird_lists(birds_json):
        """Test that all regions have at least one bird."""
        empty_regions = [
            region
            for region, birds in birds_json.items()
            if not birds or len(birds) == 0
        ]

        if empty_regions:
            pytest.fail(f"Regions with no birds: {empty_regions}")
