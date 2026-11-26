from __future__ import annotations

import re

from .helpers import load_json


def test_home_lists_regions_and_primary_navigation(page, base_url, console_errors):
    page.goto(f"{base_url}/", wait_until="networkidle")

    assert page.title() == "Audio-Birdle"
    assert page.locator("h1").inner_text() == "Audio-Birdle"
    assert "Listen close" in page.locator(".home-tagline").text_content()
    assert page.locator(".region-option").count() == 0
    assert page.locator('a[href="/regions/"]').count() >= 1
    assert page.locator(".tabbar__link").count() == 5
    assert page.locator(".skip-link").count() == 1
    assert page.locator("[data-continue]").is_hidden()
    assert (
        page.locator('link[rel="apple-touch-icon"]').get_attribute("href")
        == "/apple-touch-icon.png"
    )
    assert (
        page.locator('link[rel="manifest"]').get_attribute("href")
        == "/site.webmanifest"
    )

    assert not console_errors


def test_region_directory_search_filter_and_pin(page, base_url, console_errors):
    page.goto(f"{base_url}/regions/", wait_until="networkidle")
    assert page.locator("[data-region-row]").count() == len(load_json("regions.json"))

    page.locator("[data-region-search]").fill("australia")
    assert page.locator("[data-region-row]:visible").count() == 1
    assert "1 region shown" in page.locator("[data-region-count]").inner_text().lower()

    page.locator("[data-region-search]").fill("")
    page.locator('[data-continent-filter="europe"]').click()
    europe = [
        region
        for region in load_json("regions.json")
        if region.get("continent") == "Europe"
    ]
    assert page.locator("[data-region-row]:visible").count() == len(europe)
    assert (
        page.locator('[data-continent-filter="europe"]').get_attribute("aria-pressed")
        == "true"
    )

    page.locator('[data-continent-filter="all"]').click()
    page.locator('[data-region-favorite="gb"]').click()
    assert page.locator("[data-region-favorites] [data-region-link='gb']").count() == 1
    assert (
        page.locator('[data-region-favorite="gb"]').get_attribute("aria-pressed")
        == "true"
    )

    assert not console_errors


def test_choosing_a_region_opens_the_mode_selector(page, base_url, console_errors):
    page.goto(f"{base_url}/regions/", wait_until="networkidle")
    page.locator('.region-option[data-region-link="us"]').click()
    page.wait_for_url(re.compile(r"/play/\?region=us$"))

    assert page.locator("[data-region-label]").first.inner_text() == "United States"
    assert page.locator("[data-mode-card]").count() == 3
    assert (
        page.locator('[data-mode-card="normal"]').get_attribute("href")
        == "/normal/?region=us"
    )
    assert (
        page.locator('[data-mode-card="hard"]').get_attribute("href")
        == "/hard/?region=us"
    )
    assert (
        page.locator('[data-mode-card="practice"]').get_attribute("href")
        == "/practice/?region=us"
    )

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=us$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert page.locator("[data-play-button]").is_enabled()

    assert not console_errors


def test_gb_region_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=gb", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "United Kingdom"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=gb$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_ca_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=ca", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Canada"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=ca$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_au_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=au", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Australia"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=au$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_ie_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=ie", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Ireland"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=ie$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_za_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=za", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "South Africa"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=za$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_cr_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=cr", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Costa Rica"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=cr$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_fr_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=fr", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "France"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=fr$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_jp_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=jp", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Japan"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=jp$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_nz_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=nz", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "New Zealand"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=nz$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_de_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=de", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Germany"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=de$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_es_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=es", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Spain"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=es$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_it_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=it", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Italy"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=it$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_nl_country_pool_opens_normal_game(page, base_url, console_errors):
    page.goto(f"{base_url}/play/?region=nl", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "Netherlands"

    page.locator('[data-mode-card="normal"]').click()
    page.wait_for_url(re.compile(r"/normal/\?region=nl$"))
    page.wait_for_selector(".answer-option")

    assert page.locator(".answer-option").count() == 4
    assert page.locator("[data-audio]").get_attribute("src").startswith("https://")
    assert not console_errors


def test_unknown_page_uses_the_static_404(page, base_url):
    page.goto(f"{base_url}/does-not-exist/", wait_until="networkidle")
    assert "We couldn't find that bird" in page.locator("h1").inner_text()
