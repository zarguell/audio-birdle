"""Build assertions for the public terms page."""

from __future__ import annotations

from pathlib import Path

import pytest

from sitegen.build import build_site


@pytest.fixture(scope="module")
def built_terms(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("terms-build")
    build_site(output)
    return Path(output)


def test_terms_page_is_built(built_terms: Path) -> None:
    page = built_terms / "terms" / "index.html"
    assert page.is_file()
    html = page.read_text(encoding="utf-8")
    assert "Terms of Service" in html
    assert "2026-11-26" in html


def test_terms_page_links_privacy(built_terms: Path) -> None:
    html = (built_terms / "terms" / "index.html").read_text(encoding="utf-8")
    assert 'href="/privacy/"' in html
    footer = (built_terms / "index.html").read_text(encoding="utf-8")
    assert 'href="/terms/"' in footer
    assert 'href="/privacy/"' in footer


def test_terms_page_contains_required_sections(built_terms: Path) -> None:
    text = (built_terms / "terms" / "index.html").read_text(encoding="utf-8").lower()
    for phrase in (
        "terms of service",
        "discord",
        "not affiliated",
        "privacy",
        "macaulay",
        "xeno-canto",
        "mit license",
        "as is",
        "not liable",
        "private security advisory",
    ):
        assert phrase in text, phrase
