from __future__ import annotations

import hashlib
import json
import re

from .helpers import DATA_DIR


def test_every_data_request_is_pinned_to_the_manifest(page, base_url):
    requests: list[str] = []
    page.on("request", lambda request: requests.append(request.url))

    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")

    assert any("/data/manifest.json?t=" in url for url in requests)
    assert any("/data/birds.json?v=" in url for url in requests)
    assert any("/data/daily.json?v=" in url for url in requests)


def test_manifest_hashes_match_the_deployed_files(page, base_url):
    response = page.request.get(f"{base_url}/data/manifest.json")
    assert response.ok
    manifest = response.json()

    for name, entry in manifest["files"].items():
        data = (DATA_DIR / name).read_bytes()
        assert entry["sha256"] == hashlib.sha256(data).hexdigest()
        assert entry["bytes"] == len(data)

    served = page.request.get(f"{base_url}/data/daily.json")
    assert served.ok
    assert (
        hashlib.sha256(served.body()).hexdigest()
        == manifest["files"]["daily.json"]["sha256"]
    )


def test_cache_headers_are_split_by_asset_class(page, base_url):
    page.goto(f"{base_url}/", wait_until="networkidle")
    html = page.content()

    asset = re.search(r"/assets/[0-9a-f]{12}/css/tokens\.css", html).group(0)
    asset_response = page.request.get(f"{base_url}{asset}")
    assert asset_response.ok
    assert "immutable" in asset_response.headers["cache-control"]

    manifest_response = page.request.get(f"{base_url}/data/manifest.json")
    assert manifest_response.headers["cache-control"] == "no-store"

    page_response = page.request.get(f"{base_url}/normal/?region=us")
    headers = page_response.headers
    assert headers["cache-control"] == "no-cache"
    assert "script-src 'self'" in headers["content-security-policy"]
    assert "style-src 'self'" in headers["content-security-policy"]


def test_version_file_and_no_service_worker(page, base_url):
    page.goto(f"{base_url}/", wait_until="networkidle")

    version = page.request.get(f"{base_url}/version.json").json()
    assert re.fullmatch(r"[0-9a-f]{12}", version["assetBuildId"])
    assert re.fullmatch(r"[0-9a-f]{16}", version["releaseId"])
    assert version["dataManifestDigest"]

    registrations = page.evaluate(
        "navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((items) => items.length) : 0"
    )
    assert registrations == 0

    manifest = page.request.get(f"{base_url}/data/manifest.json").json()
    assert json.dumps(manifest).strip()


def test_manifest_failure_uses_cache_busted_fallback(page, base_url):
    page.route(
        "**/data/manifest.json*",
        lambda route: route.fulfill(status=503, body="manifest unavailable"),
    )
    requests: list[str] = []
    page.on("request", lambda request: requests.append(request.url))

    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")

    assert any("/data/daily.json?t=" in url for url in requests)
    assert any("/data/birds.json?t=" in url for url in requests)
    assert not any("/data/daily.json?v=" in url for url in requests)


def test_game_boot_never_fetches_external_media(page, base_url):
    requests: list[str] = []
    page.on("request", lambda request: requests.append(request.url))

    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")

    external = [url for url in requests if not url.startswith(base_url)]
    assert external == []
