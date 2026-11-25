"""Tests for the data manifest used to prevent mixed cache versions."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from sitegen.data_manifest import (
    build_manifest,
    manifest_digest,
    sha256_file,
    write_manifest,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"


def test_manifest_hashes_every_json_file_and_excludes_itself(tmp_path: Path) -> None:
    (tmp_path / "a.json").write_text('{"a": 1}\n', encoding="utf-8")
    (tmp_path / "b.json").write_text('{"b": 2}\n', encoding="utf-8")
    (tmp_path / "notes.txt").write_text("ignored", encoding="utf-8")
    (tmp_path / "birds").mkdir()
    (tmp_path / "birds" / "us.json").write_text("[]\n", encoding="utf-8")

    manifest = build_manifest(tmp_path)

    assert set(manifest["files"]) == {"a.json", "b.json", "birds/us.json"}
    assert manifest["schemaVersion"] == 1
    for name, entry in manifest["files"].items():
        content = (tmp_path / name).read_bytes()
        assert entry["sha256"] == hashlib.sha256(content).hexdigest()
        assert entry["bytes"] == len(content)

    write_manifest(tmp_path)
    rewritten = build_manifest(tmp_path)
    assert rewritten["files"] == manifest["files"]


def test_manifest_changes_when_a_file_changes(tmp_path: Path) -> None:
    path = tmp_path / "daily.json"
    path.write_text("[]", encoding="utf-8")
    before = build_manifest(tmp_path)
    path.write_text('[{"date": "2026-11-24"}]', encoding="utf-8")
    after = build_manifest(tmp_path)
    assert (
        before["files"]["daily.json"]["sha256"]
        != after["files"]["daily.json"]["sha256"]
    )
    assert manifest_digest(before) != manifest_digest(after)


def test_committed_public_manifest_matches_the_data() -> None:
    committed = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    generated = build_manifest(DATA)
    assert committed["files"] == generated["files"]
    assert committed["schemaVersion"] == generated["schemaVersion"]


def test_missing_directory_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        build_manifest(tmp_path / "missing")


def test_empty_directory_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        build_manifest(tmp_path)


def test_sha256_file_streams_content(tmp_path: Path) -> None:
    path = tmp_path / "blob.json"
    path.write_bytes(b"x" * (1024 * 1024 + 17))
    assert sha256_file(path) == hashlib.sha256(path.read_bytes()).hexdigest()
