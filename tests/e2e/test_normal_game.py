from __future__ import annotations

from .helpers import answer_for, today_iso


def test_normal_game_can_be_won_and_persists(page, base_url, console_errors):
    answer, entry = answer_for("us")

    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")

    options = page.locator(".answer-option").all_inner_texts()
    assert len(options) == 4
    assert sum(answer["name"] in option for option in options) == 1

    page.locator(".answer-option").filter(has_text=answer["name"]).click()
    page.wait_for_selector("[data-completion]:not([hidden])")

    assert page.locator("[data-result-title]").text_content() == "Well done!"
    assert page.locator("[data-bird-name]").inner_text() == answer["name"]
    assert page.locator("[data-share]").is_visible()
    if entry.get("subregion"):
        assert page.locator("[data-observation]:not([hidden])").count() == 1

    state = page.evaluate("JSON.parse(localStorage.getItem('audio-birdle-game'))")
    assert state["version"] == 2
    game = state["state"]["dailyGames"][f"us-{today_iso()}-normal"]
    assert game["completed"] is True
    assert game["won"] is True
    assert game["statsApplied"] is True

    page.reload(wait_until="networkidle")
    page.wait_for_selector("[data-completion]:not([hidden])")
    assert page.locator("[data-bird-name]").inner_text() == answer["name"]

    assert not console_errors


def test_stats_and_archive_reflect_a_completed_game(page, base_url, console_errors):
    answer, _ = answer_for("us")

    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option")
    page.locator(".answer-option").filter(has_text=answer["name"]).click()
    page.wait_for_selector("[data-completion]:not([hidden])")

    page.goto(f"{base_url}/stats/", wait_until="networkidle")
    values = page.locator("[data-stat-value]").all_inner_texts()
    assert values[0] == "1"
    assert values[1] == "100.0%"
    assert values[2] == "1.0"
    assert values[3] == "1"
    assert page.locator("[data-region-breakdown]").is_visible()

    page.goto(f"{base_url}/archive/?region=us", wait_until="networkidle")
    page.wait_for_selector(".archive-entry")
    assert page.locator(".archive-entry").count() > 0
    first_date = page.locator("[data-archive-date]").first.inner_text()
    assert first_date
    created = page.locator(".archive-entry").first.get_attribute("data-archive-date")
    assert created < today_iso()

    assert not console_errors
