"""Unit tests for the Jinja static site build."""

from __future__ import annotations

import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

import pytest

from sitegen.build import build_site
from sitegen.config import PUBLIC_DIR, STATIC_DIR, TEMPLATES_DIR
from sitegen.data_manifest import build_manifest

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ROOT_ICON_ASSETS = {
    "/favicon.ico",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/favicon-48x48.png",
    "/apple-touch-icon.png",
}


class AssetCollector(HTMLParser):
    """Collect external assets and inline script/style content from HTML."""

    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []
        self.inline_scripts: list[str] = []
        self.inline_styles: list[str] = []
        self._script_depth = 0
        self._style_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag in {"script", "style"}:
            self._handle_embedded(tag, attributes)
        elif tag in {"link", "img"}:
            self._handle_reference(tag, attributes)

    def _handle_embedded(self, tag: str, attributes: dict[str, str | None]) -> None:
        if tag == "style":
            self._style_depth += 1
        elif attributes.get("src"):
            self.assets.append(attributes["src"] or "")
        else:
            self._script_depth += 1

    def _handle_reference(self, tag: str, attributes: dict[str, str | None]) -> None:
        if tag == "img":
            self._append_source(attributes)
        else:
            self._append_stylesheet_or_icon(attributes)

    def _append_source(self, attributes: dict[str, str | None]) -> None:
        source = attributes.get("src")
        if source:
            self.assets.append(source)

    def _append_stylesheet_or_icon(self, attributes: dict[str, str | None]) -> None:
        href = attributes.get("href")
        rel = attributes.get("rel", "")
        if not href:
            return
        if "stylesheet" in rel:
            self.assets.append(href)
        elif "icon" in rel:
            self.assets.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._script_depth:
            self._script_depth -= 1
        elif tag == "style" and self._style_depth:
            self._style_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._script_depth and data.strip():
            self.inline_scripts.append(data)
        if self._style_depth and data.strip():
            self.inline_styles.append(data)


@pytest.fixture(scope="module")
def built_site(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict]:
    output = tmp_path_factory.mktemp("site-build")
    summary = build_site(output)
    return Path(summary["output_dir"]), summary


def test_build_renders_every_page(built_site: tuple[Path, dict]) -> None:
    output, summary = built_site
    for page in (
        "index.html",
        "play/index.html",
        "normal/index.html",
        "hard/index.html",
        "practice/index.html",
        "stats/index.html",
        "archive/index.html",
        "settings/index.html",
        "404.html",
    ):
        assert (output / page).is_file(), page
    assert len(summary["pages"]) == 9
    assert summary["regions"] == 5


def test_build_uses_content_addressed_assets(built_site: tuple[Path, dict]) -> None:
    output, summary = built_site
    build_id = summary["asset_build_id"]
    assert re.fullmatch(r"[0-9a-f]{12}", build_id)
    assets = output / "assets" / build_id
    assert (assets / "css" / "tokens.css").is_file()
    assert (assets / "js" / "pages" / "home.js").is_file()
    assert (assets / "js" / "pages" / "game.js").is_file()
    assert (assets / "fonts" / "vt323-latin.woff2").is_file()
    assert (assets / "img" / "forest-scene.svg").is_file()
    assert (assets / "img" / "bird-mark.svg").is_file()
    assert not (output / "assets" / "css").exists()


def test_pages_reference_only_hashed_external_assets(
    built_site: tuple[Path, dict],
) -> None:
    output, _ = built_site
    for html_path in output.rglob("*.html"):
        parser = AssetCollector()
        parser.feed(html_path.read_text(encoding="utf-8"))
        assert parser.inline_scripts == [], f"inline script in {html_path}"
        assert parser.inline_styles == [], f"inline style in {html_path}"
        for asset in parser.assets:
            if not asset.startswith("/"):
                continue
            if asset in ROOT_ICON_ASSETS:
                assert (output / asset.lstrip("/")).is_file(), (
                    f"missing icon {asset} referenced by {html_path}"
                )
                continue
            assert asset.startswith("/assets/"), (
                f"unhashed asset {asset} in {html_path}"
            )
            local = output / asset.lstrip("/")
            assert local.is_file(), f"missing asset {asset} referenced by {html_path}"


def test_region_links_are_server_rendered(built_site: tuple[Path, dict]) -> None:
    output, _ = built_site
    html = (output / "index.html").read_text(encoding="utf-8")
    assert 'href="/play/?region=us"' in html
    assert 'href="/play/?region=us-lower48"' in html
    assert 'href="/play/?region=gb"' in html
    assert 'href="/play/?region=ca"' in html
    assert 'href="/play/?region=au"' in html
    assert "United States" in html
    assert "US Lower 48" in html
    assert "United Kingdom" in html
    assert "Canada" in html
    assert "Australia" in html


def test_data_manifest_matches_copied_files(built_site: tuple[Path, dict]) -> None:
    output, summary = built_site
    manifest = json.loads(
        (output / "data" / "manifest.json").read_text(encoding="utf-8")
    )
    assert manifest["schemaVersion"] == 1
    assert "manifest.json" not in manifest["files"]
    for name, entry in manifest["files"].items():
        data = (output / "data" / name).read_bytes()
        assert entry["sha256"] == hashlib.sha256(data).hexdigest()
        assert entry["bytes"] == len(data)
        assert entry["path"] == f"/data/{name}"
    assert summary["data_files"] == len(manifest["files"]) == 5


def test_cloudflare_headers_pin_cache_behaviour(built_site: tuple[Path, dict]) -> None:
    output, _ = built_site
    headers = (output / "_headers").read_text(encoding="utf-8")
    assert "Content-Security-Policy:" in headers
    assert "script-src 'self'" in headers
    assert "style-src 'self'" in headers
    assert "/assets/*" in headers
    assert "immutable" in headers
    assert "/data/manifest.json" in headers
    assert "no-store" in headers
    assert "Cache-Control: no-cache" in headers


def test_version_and_build_summary_are_written(built_site: tuple[Path, dict]) -> None:
    output, summary = built_site
    version = json.loads((output / "version.json").read_text(encoding="utf-8"))
    assert version["assetBuildId"] == summary["asset_build_id"]
    assert version["releaseId"] == summary["release_id"]
    assert version["dataManifestDigest"] == summary["data_manifest_digest"]
    assert (output / "sitemap.xml").is_file()
    assert (output / "robots.txt").is_file()


def test_manifest_generation_is_stable() -> None:
    manifest = build_manifest(PUBLIC / "data")
    assert manifest["files"]
    assert manifest["files"] == build_manifest(PUBLIC / "data")["files"]
    assert manifest["files"]["daily.json"]["sha256"]


def test_public_assets_are_copied(built_site: tuple[Path, dict]) -> None:
    output, _ = built_site
    for asset in ROOT_ICON_ASSETS:
        assert (output / asset.lstrip("/")).is_file(), asset
    assert (output / "site.webmanifest").is_file()
    assert (output / "_headers").is_file()
    assert (output / "data" / "daily.json").is_file()


def test_web_app_manifest_references_real_icons(built_site: tuple[Path, dict]) -> None:
    output, _ = built_site
    manifest = json.loads((output / "site.webmanifest").read_text(encoding="utf-8"))
    assert manifest["name"] == "Audio-Birdle"
    assert manifest["start_url"] == "/"
    assert manifest["icons"]
    for icon in manifest["icons"]:
        assert (output / icon["src"].lstrip("/")).is_file(), icon["src"]


def test_templates_and_static_tree_are_the_source(
    built_site: tuple[Path, dict],
) -> None:
    _, summary = built_site
    assert is_non_empty_dir(STATIC_DIR)
    assert is_non_empty_dir(TEMPLATES_DIR)
    assert PUBLIC_DIR.is_dir()
    assert summary["release_id"]


def is_non_empty_dir(path: Path) -> bool:
    return path.is_dir() and any(path.iterdir())
