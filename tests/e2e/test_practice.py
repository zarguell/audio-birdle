from __future__ import annotations


def finish_normal_round(page) -> None:
    page.wait_for_selector(".answer-option")
    for _ in range(4):
        if page.locator("[data-completion]:not([hidden])").count():
            break
        page.locator(".answer-option").first.click()
        page.wait_for_timeout(100)
    page.wait_for_selector("[data-completion]:not([hidden])")


def test_practice_rounds_do_not_touch_stats(page, base_url, console_errors):
    page.goto(f"{base_url}/practice/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")
    assert page.locator(".answer-option").count() == 4

    finish_normal_round(page)
    assert page.locator("[data-practice-actions]").is_visible()

    page.locator("[data-practice-next]").click()
    page.wait_for_selector(".answer-option")
    assert "Practice round #2" == page.locator("[data-date-label]").text_content()
    assert page.locator("[data-completion]").is_hidden()

    page.locator("[data-practice-toggle]").click()
    page.wait_for_selector("[data-hard-input]:not([disabled])")
    assert page.locator("[data-hard-section]").is_visible()
    assert page.locator("[data-options-section]").is_hidden()

    page.locator("[data-practice-toggle]").click()
    page.wait_for_selector(".answer-option")
    assert page.locator("[data-hard-section]").is_hidden()

    page.goto(f"{base_url}/stats/", wait_until="networkidle")
    assert page.locator("[data-stat-value]").first.inner_text() == "0"
    assert page.locator("[data-stats-empty]").is_visible()

    assert not console_errors
