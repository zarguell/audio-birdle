from __future__ import annotations

from .helpers import answer_for


def win_normal(page, base_url) -> None:
    answer, _ = answer_for("us")
    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")
    page.locator(".answer-option").filter(has_text=answer["name"]).click()
    page.wait_for_selector("[data-completion]:not([hidden])")


def test_reset_today_keeps_recorded_stats_then_reset_all_clears_them(
    page, base_url, console_errors
):
    win_normal(page, base_url)

    page.goto(f"{base_url}/settings/", wait_until="networkidle")
    assert page.locator("[data-region-label]").first.inner_text() == "United States"
    page.locator("[data-reset-today]").click()
    page.wait_for_timeout(100)

    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")
    assert page.locator("[data-completion]").is_hidden()

    page.goto(f"{base_url}/stats/", wait_until="networkidle")
    assert page.locator("[data-stat-value]").first.inner_text() == "1"

    page.goto(f"{base_url}/settings/", wait_until="networkidle")
    page.locator("[data-reset-all]").click()
    page.wait_for_selector("[data-confirm-dialog][open]")
    page.locator('[data-confirm-dialog] button[value="confirm"]').click()
    page.wait_for_timeout(200)

    page.goto(f"{base_url}/stats/", wait_until="networkidle")
    assert page.locator("[data-stat-value]").first.inner_text() == "0"
    assert page.locator("[data-stats-empty]").is_visible()

    page.goto(f"{base_url}/settings/", wait_until="networkidle")
    page.locator("[data-change-region]").click()
    page.wait_for_url(f"{base_url}/regions/")
    assert page.evaluate("localStorage.getItem('audio-birdle-region')") == "us"

    assert not console_errors
