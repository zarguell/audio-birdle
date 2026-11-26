"""Build assertions for the public Discord landing page."""

from __future__ import annotations

from pathlib import Path

import pytest

from sitegen.build import build_site


@pytest.fixture(scope="module")
def built_discord(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("discord-build")
    build_site(output)
    return Path(output)


def test_discord_page_is_built(built_discord: Path) -> None:
    page = built_discord / "discord" / "index.html"
    assert page.is_file()
    html = page.read_text(encoding="utf-8")
    assert "Play in Discord" in html


def test_discord_page_has_install_link_and_commands(built_discord: Path) -> None:
    html = (built_discord / "discord" / "index.html").read_text(encoding="utf-8")
    assert "discord.com/oauth2/authorize?client_id=1575568221715697744" in html
    assert "permissions=54272" in html
    assert "/audiobirdle-setup" in html
    assert "/audiobirdle-stats" in html
    assert "/audiobirdle-forget" in html
    assert 'href="/privacy/"' in html
    assert 'href="/terms/"' in html


def test_home_and_footer_link_discord(built_discord: Path) -> None:
    home = (built_discord / "index.html").read_text(encoding="utf-8")
    assert 'href="/discord/"' in home
