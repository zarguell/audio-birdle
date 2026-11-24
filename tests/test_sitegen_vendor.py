"""Vendored component provenance checks."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "sitegen" / "vendor"


def test_forever_components_are_pinned_to_a_full_commit() -> None:
    data = json.loads((VENDOR / "forever-components.json").read_text(encoding="utf-8"))
    assert re.fullmatch(r"[0-9a-f]{40}", data["commit"])
    assert data["license"] == "MIT"
    assert data["repository"].startswith(
        "https://github.com/isas1/forever-ai-components"
    )
    assert data["adapted"]

    for adapted in data["adapted"]:
        assert adapted["file"].startswith("infinite/")
        for used_in in adapted["usedIn"].split(" + "):
            assert (ROOT / used_in).exists(), used_in

    license_text = (VENDOR / "forever-ai-components.LICENSE").read_text(
        encoding="utf-8"
    )
    assert "MIT License" in license_text


def test_vendored_font_is_sha_pinned() -> None:
    fonts = json.loads((VENDOR / "fonts.json").read_text(encoding="utf-8"))
    assert "VT323" in fonts
    font = fonts["VT323"]
    font_path = ROOT / font["file"]
    assert font_path.is_file()
    assert hashlib.sha256(font_path.read_bytes()).hexdigest() == font["sha256"]
    assert font["license"] == "SIL Open Font License 1.1"
    license_text = (ROOT / font["licenseFile"]).read_text(encoding="utf-8")
    assert "SIL OPEN FONT LICENSE" in license_text
