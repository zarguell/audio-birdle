from __future__ import annotations

from .helpers import answer_for, other_bird


def test_hard_mode_reports_taxonomy_and_completes(page, base_url, console_errors):
    answer, _ = answer_for("us")
    wrong = other_bird(answer["id"])

    page.goto(f"{base_url}/hard/?region=us", wait_until="networkidle")
    page.wait_for_selector("[data-hard-input]:not([disabled])")

    page.fill("[data-hard-input]", wrong["name"])
    page.wait_for_selector(".suggestion")
    page.locator(".suggestion").first.click()
    page.wait_for_selector(".guess--hard")

    assert page.locator(".guess--hard").count() == 1
    assert page.locator("[data-remaining]").text_content().startswith("5 guesses")
    assert page.locator("[data-hint-order]").is_visible()
    assert page.locator("[data-hint-family]").is_hidden()
    assert page.locator("[data-badges] .badge").count() == 4

    page.fill("[data-hard-input]", answer["name"])
    page.wait_for_selector(".suggestion")
    page.locator(".suggestion").first.click()
    page.wait_for_selector("[data-completion]:not([hidden])")

    assert page.locator("[data-result-title]").text_content() == "Well done!"
    assert page.locator("[data-bird-name]").inner_text() == answer["name"]

    assert not console_errors
