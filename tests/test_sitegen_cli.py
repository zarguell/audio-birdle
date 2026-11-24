"""CLI smoke tests for the static site generator."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from sitegen.cli import main


def test_manifest_command_writes_the_manifest(tmp_path: Path) -> None:
    (tmp_path / "daily.json").write_text("[]", encoding="utf-8")
    assert main(["manifest", "--data-dir", str(tmp_path)]) == 0
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert "daily.json" in manifest["files"]


def test_build_command_renders_a_site(tmp_path: Path) -> None:
    output = tmp_path / "site"
    assert main(["build", "--output", str(output)]) == 0
    assert (output / "index.html").is_file()
    assert (output / "data" / "manifest.json").is_file()
    assert (output / "assets").is_dir()


def test_unknown_command_exits_with_an_error() -> None:
    with pytest.raises(SystemExit):
        main(["not-a-command"])
