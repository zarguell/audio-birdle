#!/usr/bin/env python3
"""
Generate hash values for testing Python-JavaScript hash consistency.

This script outputs hash values for common bird IDs that can be used
to populate the JavaScript integration tests (KNOWN_HASHES in
tests/integration/hash-consistency.test.js).

Usage:
    python scripts/verify_hash_consistency.py

Output format: bird_id:hash (one per line)
"""

import importlib.util
import os
import sys

# The generator lives in a dashed filename (generate-daily-birds.py), which is
# not a valid Python module name, so load it explicitly via importlib — the
# same approach the test suite uses.
SCRIPT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "generate-daily-birds.py"
)


def load_hash_bird_id():
    """Load hash_bird_id from generate-daily-birds.py via importlib."""
    spec = importlib.util.spec_from_file_location("generate_daily_birds", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.hash_bird_id


def generate_test_hashes():
    """Generate hashes for common bird IDs to verify consistency."""
    try:
        hash_bird_id = load_hash_bird_id()
    except Exception as e:
        print(f"ERROR: Could not load hash_bird_id from generate-daily-birds.py: {e}")
        print("Make sure generate-daily-birds.py exists and exports hash_bird_id()")
        sys.exit(1)

    # Common bird IDs to test
    test_bird_ids = [
        'amerob',    # American Robin
        'mallar3',   # Mallard
        'horlar',    # Hairy Woodpecker
        'barswa',    # Barn Swallow
        'commer',    # Common Yellowthroat
        'nobsho',    # Northern Bobwhite
        'rebsap',    # Red-bellied Sap... (example)
        'songpa',    # Song Sparrow
        'amespa',    # American Sparrow (example)
        'whcspa',    # White-crowned Sparrow
    ]

    # Edge cases
    edge_cases = [
        '',
        'a',
        'abc123',
        'bird-with-multiple-dashes',
        'UPPERCASE',
        'lowercase',
        '1234567890',
        'bird-with-!@#-special',
    ]

    print("=" * 60)
    print("HASH VALUES FOR COMMON BIRD IDS")
    print("Copy these into KNOWN_HASHES in hash-consistency.test.js")
    print("=" * 60)
    print()

    print("Common Bird IDs:")
    print("-" * 40)
    for bird_id in test_bird_ids:
        hash_value = hash_bird_id(bird_id)
        print(f"  '{bird_id}': '{hash_value}',")

    print()
    print("Edge Cases:")
    print("-" * 40)
    for bird_id in edge_cases:
        hash_value = hash_bird_id(bird_id)
        # Escape special characters for JavaScript
        escaped_id = bird_id.replace("'", "\\'")
        print(f"  '{escaped_id}': '{hash_value}',")

    print()
    print("=" * 60)
    print("SALT VALUE (must match JavaScript)")
    print("=" * 60)
    print("  Both implementations should use: 'birdle-salt-2025'")
    print()

    return test_bird_ids, edge_cases


if __name__ == '__main__':
    generate_test_hashes()
