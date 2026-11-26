"""Build assertions for the public privacy page."""

from __future__ import annotations

from pathlib import Path

import pytest

from sitegen.build import build_site


@pytest.fixture(scope="module")
def built_privacy(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("privacy-build")
    build_site(output)
    return Path(output)


def test_privacy_page_is_built(built_privacy: Path) -> None:
    page = built_privacy / "privacy" / "index.html"
    assert page.is_file()
    html = page.read_text(encoding="utf-8")
    assert "Privacy policy" in html
    assert "2026-11-26" in html
    # The beacon is injected only after consent; the HTML must not load it.
    assert "beacon.min.js" not in html


def test_settings_links_to_privacy_and_analytics_toggle(built_privacy: Path) -> None:
    settings = (built_privacy / "settings" / "index.html").read_text(encoding="utf-8")
    assert 'href="/privacy/"' in settings
    assert "data-analytics-consent" in settings
    assert "Anonymous usage analytics" in settings


def test_privacy_page_contains_required_disclosures(built_privacy: Path) -> None:
    html = (built_privacy / "privacy" / "index.html").read_text(encoding="utf-8")
    text = html.lower()
    for phrase in (
        "off by default",
        "cloudflare web analytics",
        "page path",
        "referrer",
        "country",
        "browser and operating system",
        "core web vitals",
        "no cookies",
        "localstorage",
        "fingerprinting",
        "withdraw",
        "discord",
        "up to 90 days",
        "up to 48 hours",
        "/audiobirdle forget",
        "delet",
        "macaulay",
        "xeno-canto",
        "privately-reporting-a-security-vulnerability",
    ):
        assert phrase in text, phrase
