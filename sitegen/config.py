"""Paths and shared site metadata for the generator."""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PACKAGE_DIR.parent
PUBLIC_DIR = ROOT_DIR / "public"
TEMPLATES_DIR = PACKAGE_DIR / "templates"
STATIC_DIR = PACKAGE_DIR / "static"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "dist"

DATA_SUBDIR = "data"
MANIFEST_FILENAME = "manifest.json"

SITE = {
    "name": "Audio-Birdle",
    "description": (
        "A daily bird song identification game inspired by Wordle. "
        "Listen to bird songs and guess the species."
    ),
    "theme_color": "#2f6b4f",
    "repo_url": "https://github.com/zarguell/audio-birdle",
    "live_url": "https://audio-birdle.sechostlab.com",
}

# A gameplay shard is one region's birds. Keep the compressed payload bounded
# so adding countries cannot silently inflate the selected-region download.
BIRD_SHARD_GZIP_BUDGET = 200 * 1024

# Data files that must exist before a site build. The manifest is generated
# separately because it describes these files.
REQUIRED_DATA_FILES = (
    "regions.json",
    "daily.json",
    "history.json",
    "daily-subregion-birds.json",
)

BIRDS_SUBDIR = "birds"
