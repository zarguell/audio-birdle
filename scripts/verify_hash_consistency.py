#!/usr/bin/env python3
"""
Generate hash values for testing Python-JavaScript hash consistency.

This script outputs hash values for common bird IDs that can be used
to populate the JavaScript integration tests.

Usage:
    python scripts/verify_hash_consistency.py

Output format: bird_id:hash (one per line)
"""

import sys
import os

# Add scripts directory to path to import from generate_daily_birds
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

def generate_test_hashes():
    """Generate hashes for common bird IDs to verify consistency."""
    try:
        from generate_daily_birds import hash_bird_id
    except ImportError:
        print("ERROR: Could not import hash_bird_id from generate_daily_birds.py")
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
    print("Copy these into PYTHON_HASH_OUTPUTS in hash-consistency.test.js")
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
