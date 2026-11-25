from __future__ import annotations

import re


def test_home_lists_regions_and_primary_navigation(page, base_url, console_errors):
    page.goto(f"{base_url}/", wait_until="networkidle")

    assert page.title() == "Audio-Birdle"
    assert page.locator("h1").inner_text() == "Audio-Birdle"
    assert "Listen close" in page.locator(".home-tagline").text_content()
    assert page.locator(".region-option").count() == 5
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


def test_choosing_a_region_opens_the_mode_selector(page, base_url, console_errors):
    page.goto(f"{base_url}/", wait_until="networkidle")
    page.locator('[data-region-link="us"]').click()
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


def test_unknown_page_uses_the_static_404(page, base_url):
    page.goto(f"{base_url}/does-not-exist/", wait_until="networkidle")
    assert "We couldn't find that bird" in page.locator("h1").inner_text()
