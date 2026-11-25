"""Build the Audio-Birdle static site.

The build is intentionally small and boring:

1. copy committed public assets (data, headers, icon) into ``dist/``,
2. copy lintable CSS/JS into a content-addressed ``assets/<build-id>/`` tree,
3. render Jinja templates,
4. write a SHA-256 manifest for the data files and a deploy summary.

No Node.js process, package installation, bundler, or client-side build cache is
involved.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .config import (
    DATA_SUBDIR,
    DEFAULT_OUTPUT_DIR,
    PUBLIC_DIR,
    ROOT_DIR,
    SITE,
    STATIC_DIR,
    TEMPLATES_DIR,
)
from .data import validate_data
from .data_manifest import manifest_digest, write_manifest

# (page key, output path, template name, extra context)
PAGES = (
    ("home", "index.html", "home.html", {}),
    ("regions", "regions/index.html", "regions.html", {}),
    ("play", "play/index.html", "play.html", {}),
    ("normal", "normal/index.html", "game.html", {"game_mode": "normal"}),
    ("hard", "hard/index.html", "game.html", {"game_mode": "hard"}),
    ("practice", "practice/index.html", "game.html", {"game_mode": "practice"}),
    ("stats", "stats/index.html", "stats.html", {}),
    ("archive", "archive/index.html", "archive.html", {}),
    ("settings", "settings/index.html", "settings.html", {}),
    ("error", "404.html", "error.html", {}),
)

SCRIPTS = {
    "home": "pages/home.js",
    "regions": "pages/regions.js",
    "play": "pages/play.js",
    "normal": "pages/game.js",
    "hard": "pages/game.js",
    "practice": "pages/game.js",
    "stats": "pages/stats.js",
    "archive": "pages/archive.js",
    "settings": "pages/settings.js",
    "error": "pages/error.js",
}


class BuildError(RuntimeError):
    """Raised when the site cannot be rendered safely."""


@dataclass(frozen=True)
class BuildPaths:
    """Input and output locations for one build."""

    output_dir: Path = DEFAULT_OUTPUT_DIR
    public_dir: Path = PUBLIC_DIR
    static_dir: Path = STATIC_DIR
    templates_dir: Path = TEMPLATES_DIR


@dataclass(frozen=True)
class BuildIdentity:
    """Content hashes that identify one build."""

    asset_build_id: str
    release_id: str


def _hash_tree(root: Path, paths: list[Path] | None = None) -> str:
    digest = hashlib.sha256()
    paths = paths if paths is not None else sorted(root.rglob("*"))
    for path in sorted(paths):
        if not path.is_file():
            continue
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def asset_build_id(static_dir: Path = STATIC_DIR) -> str:
    """Return a content hash for the CSS/JS tree."""
    return _hash_tree(static_dir)[:12]


def release_id(
    static_dir: Path = STATIC_DIR, templates_dir: Path = TEMPLATES_DIR
) -> str:
    """Return a content hash covering templates and static assets."""
    digest = hashlib.sha256()
    digest.update(_hash_tree(static_dir).encode("ascii"))
    digest.update(_hash_tree(templates_dir).encode("ascii"))
    return digest.hexdigest()[:16]


def _environment(asset_base: str, templates_dir: Path) -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(templates_dir)),
        autoescape=select_autoescape(("html", "xml")),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.globals.update(
        {
            "asset_base": asset_base,
            "site": SITE,
            "year": datetime.now(timezone.utc).year,
        }
    )
    return env


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


CONTINENT_ORDER = (
    "North America",
    "Europe",
    "Oceania",
    "Asia",
    "Africa",
    "South America",
)


def _continent_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "other"


def region_groups(regions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group regions for the directory, preserving continent display order."""
    grouped: dict[str, list[dict[str, Any]]] = {}
    order = {region.get("id"): index for index, region in enumerate(regions)}
    for region in regions:
        continent = region.get("continent") or "Other"
        grouped.setdefault(continent, []).append(region)

    names = [name for name in CONTINENT_ORDER if name in grouped]
    names.extend(sorted(name for name in grouped if name not in CONTINENT_ORDER))

    groups = []
    for name in names:
        def sort_key(region: dict[str, Any]) -> tuple[int, int, int]:
            region_id = region.get("id")
            parent_id = region.get("parentRegion")
            base = order.get(parent_id, order.get(region_id, 0))
            return (
                base,
                0 if not parent_id else 1,
                order.get(region_id, 0),
            )

        entries = sorted(grouped[name], key=sort_key)
        groups.append(
            {"id": _continent_id(name), "name": name, "regions": entries}
        )
    return groups


def _render_pages(
    output_dir: Path,
    regions: list[dict[str, Any]],
    identity: BuildIdentity,
    templates_dir: Path,
) -> list[str]:
    env = _environment(f"/assets/{identity.asset_build_id}", templates_dir)
    rendered: list[str] = []

    groups = region_groups(regions)
    for page, output_path, template_name, extra in PAGES:
        template = env.get_template(f"pages/{template_name}")
        context = {
            "page": page,
            "page_script": SCRIPTS[page],
            "regions": regions,
            "region_groups": groups,
            "release_id": identity.release_id,
            "build_id": identity.asset_build_id,
            **extra,
        }
        html = template.render(**context)
        if not html.strip():
            raise BuildError(f"Template {template_name} rendered empty output")
        _write(output_dir / output_path, html)
        rendered.append(output_path)

    return rendered


def _write_support_files(output_dir: Path, identity: BuildIdentity) -> None:
    live_url = SITE["live_url"].rstrip("/")
    routes = (
        "/",
        "/regions/",
        "/play/",
        "/normal/",
        "/hard/",
        "/practice/",
        "/archive/",
        "/stats/",
        "/settings/",
    )
    urls = "\n".join(f"  <url><loc>{live_url}{route}</loc></url>" for route in routes)
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n"
        "</urlset>\n"
    )
    _write(output_dir / "sitemap.xml", sitemap)
    _write(
        output_dir / "robots.txt",
        f"User-agent: *\nAllow: /\n\nSitemap: {live_url}/sitemap.xml\n",
    )

    generated_at = (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )
    _write(
        output_dir / "version.json",
        json.dumps(
            {
                "releaseId": identity.release_id,
                "assetBuildId": identity.asset_build_id,
                "generatedAt": generated_at,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
    )


def _validate_paths(output_dir: Path, paths: BuildPaths) -> None:
    if not paths.public_dir.is_dir():
        raise BuildError(f"Public directory not found: {paths.public_dir}")
    if not paths.static_dir.is_dir():
        raise BuildError(f"Static asset directory not found: {paths.static_dir}")

    resolved_output = output_dir.resolve()
    if resolved_output in {ROOT_DIR.resolve(), PUBLIC_DIR.resolve()}:
        raise BuildError(f"Refusing to clean protected directory: {output_dir}")


def _copy_inputs(paths: BuildPaths, output_dir: Path, clean: bool) -> None:
    if clean and output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    shutil.copytree(paths.public_dir, output_dir, dirs_exist_ok=True)


def _copy_assets(paths: BuildPaths, output_dir: Path, build_id: str) -> None:
    shutil.copytree(
        paths.static_dir,
        output_dir / "assets" / build_id,
    )


def _write_data_manifest(output_dir: Path) -> dict[str, Any]:
    manifest_path = write_manifest(output_dir / DATA_SUBDIR)
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _write_version(output_dir: Path, manifest: dict[str, Any]) -> None:
    version_path = output_dir / "version.json"
    version = json.loads(version_path.read_text(encoding="utf-8"))
    version["dataManifestDigest"] = manifest_digest(manifest)
    _write(version_path, json.dumps(version, indent=2, sort_keys=True) + "\n")


def _write_build_summary(output_dir: Path, summary: dict[str, Any]) -> None:
    public_summary = {
        key: value for key, value in summary.items() if key != "output_dir"
    }
    _write(
        output_dir / "build-summary.json",
        json.dumps(public_summary, indent=2, sort_keys=True) + "\n",
    )


def build_site(
    output_dir: Path | str | None = None,
    *,
    paths: BuildPaths | None = None,
    clean: bool = True,
) -> dict[str, Any]:
    """Render the complete site and return a small build summary."""
    paths = paths or BuildPaths()
    output_dir = Path(output_dir) if output_dir is not None else paths.output_dir

    _validate_paths(output_dir, paths)
    regions = validate_data(paths.public_dir / DATA_SUBDIR)
    identity = BuildIdentity(
        asset_build_id=asset_build_id(paths.static_dir),
        release_id=release_id(paths.static_dir, paths.templates_dir),
    )

    _copy_inputs(paths, output_dir, clean)
    _copy_assets(paths, output_dir, identity.asset_build_id)
    rendered = _render_pages(
        output_dir,
        regions,
        identity,
        paths.templates_dir,
    )
    manifest = _write_data_manifest(output_dir)
    _write_support_files(output_dir, identity)
    _write_version(output_dir, manifest)

    summary = {
        "output_dir": str(output_dir),
        "asset_build_id": identity.asset_build_id,
        "release_id": identity.release_id,
        "pages": rendered,
        "regions": len(regions),
        "data_files": len(manifest["files"]),
        "data_manifest_digest": manifest_digest(manifest),
    }
    _write_build_summary(output_dir, summary)
    return summary
