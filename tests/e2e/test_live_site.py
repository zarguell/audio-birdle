"""Integration checks against the deployed Cloudflare site.

These tests are opt-in so the normal suite never depends on the public
internet. The scheduled live-site workflow sets ``LIVE_SITE_URL``.
"""

# Pytest fixtures intentionally shadow their factory names.
# pylint: disable=redefined-outer-name

from __future__ import annotations

import hashlib
import os
import re

import pytest

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def live_url() -> str:
    url = os.environ.get("LIVE_SITE_URL", "").strip().rstrip("/")
    if not url:
        pytest.skip("Set LIVE_SITE_URL to run live-site integration tests")
    return url


def test_live_home_and_manifest(page, live_url):
    page.goto(f"{live_url}/", wait_until="networkidle")

    assert "Audio-Birdle" in page.title()
    assert page.locator(".region-option").count() >= 1
    assert page.locator(".tabbar__link").count() == 5

    response = page.request.get(f"{live_url}/data/manifest.json")
    assert response.ok
    manifest = response.json()
    assert manifest["schemaVersion"] == 1
    assert "daily.json" in manifest["files"]
    assert "birds.json" in manifest["files"]

    for name, entry in manifest["files"].items():
        file_response = page.request.get(f"{live_url}{entry['path']}")
        assert file_response.ok, name
        assert hashlib.sha256(file_response.body()).hexdigest() == entry["sha256"]


def test_live_cache_and_security_headers(page, live_url):
    page.goto(f"{live_url}/", wait_until="networkidle")
    html = page.content()

    asset = re.search(r"/assets/[0-9a-f]{12}/css/tokens\.css", html)
    assert asset, "Live HTML does not reference a content-addressed stylesheet"
    asset_response = page.request.get(f"{live_url}{asset.group(0)}")
    assert asset_response.ok
    assert "immutable" in asset_response.headers.get("cache-control", "")

    manifest_response = page.request.get(f"{live_url}/data/manifest.json")
    assert manifest_response.headers.get("cache-control") == "no-store"

    page_response = page.request.get(f"{live_url}/normal/?region=us")
    assert page_response.ok
    assert page_response.headers.get("cache-control") == "no-cache"
    csp = page_response.headers.get("content-security-policy", "")
    assert "script-src 'self'" in csp
    assert "style-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp


def test_live_normal_game_boots(page, live_url):
    page.goto(f"{live_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option", timeout=20000)

    assert page.locator(".answer-option").count() == 4
    audio = page.locator("[data-audio]").get_attribute("src")
    assert audio and audio.startswith("https://")
    assert page.locator("[data-play-button]").is_enabled()
    assert page.locator("[data-game-loading]").is_hidden()
