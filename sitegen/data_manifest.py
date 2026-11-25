"""Content-hash manifests for game data files.

Cloudflare can serve an old bird shard next to a new daily.json while a deploy
propagates, and browsers may keep either file in cache. The site therefore
loads every data file through a manifest that pins each file to its SHA-256.
The manifest itself is served with ``Cache-Control: no-store`` and is fetched
with a cache-busting query, so a page always uses one coherent data snapshot.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import MANIFEST_FILENAME

MANIFEST_SCHEMA_VERSION = 1


def sha256_file(path: Path) -> str:
    """Return the lowercase hex SHA-256 digest of *path*."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(data_dir: Path) -> dict[str, Any]:
    """Build a manifest describing every JSON data file in *data_dir*.

    The manifest file itself is excluded so regenerating it never changes the
    hashes it contains.
    """
    data_dir = Path(data_dir)
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    files: dict[str, dict[str, Any]] = {}
    for path in sorted(data_dir.rglob("*.json")):
        if path.name == MANIFEST_FILENAME:
            continue
        relative = path.relative_to(data_dir).as_posix()
        files[relative] = {
            "path": f"/data/{relative}",
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
        }

    if not files:
        raise FileNotFoundError(f"No JSON data files found in {data_dir}")

    generated_at = (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )
    return {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "generatedAt": generated_at,
        "files": files,
    }


def write_manifest(data_dir: Path) -> Path:
    """Write ``manifest.json`` atomically into *data_dir* and return its path."""
    data_dir = Path(data_dir)
    manifest = build_manifest(data_dir)
    destination = data_dir / MANIFEST_FILENAME
    temporary = destination.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, destination)
    return destination


def manifest_digest(manifest: dict[str, Any]) -> str:
    """Stable digest of the file set, used for build reporting."""
    payload = json.dumps(manifest.get("files", {}), sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
