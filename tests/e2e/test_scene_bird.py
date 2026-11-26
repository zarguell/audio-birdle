from __future__ import annotations

from .helpers import answer_for, other_bird


def click_bird(page) -> None:
    bird = page.locator("[data-scene-bird]")
    box = bird.bounding_box()
    assert box, "scene bird has no bounding box"
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)


def wait_for_state(page, value: str, timeout: int = 6000) -> None:
    page.wait_for_selector(
        f'[data-scene-bird][data-state="{value}"]',
        state="attached",
        timeout=timeout,
    )


def wait_for_reaction(page, value: str, timeout: int = 4000) -> None:
    page.wait_for_selector(
        f'[data-scene-bird][data-last-reaction="{value}"]',
        state="attached",
        timeout=timeout,
    )


def test_home_bird_flies_on_click(page, base_url, console_errors):
    page.goto(f"{base_url}/", wait_until="networkidle")
    assert page.locator("[data-scene-bird]").get_attribute("data-state") == "perched"
    assert (
        page.locator(".scene-clouds").evaluate(
            "element => getComputedStyle(element).animationName"
        )
        == "cloud-drift"
    )
    assert (
        page.locator(".scene-fireflies").evaluate(
            "element => getComputedStyle(element).animationName"
        )
        == "firefly-glow"
    )
    assert (
        page.locator(".scene-art").evaluate(
            "element => getComputedStyle(element).viewTransitionName"
        )
        == "scene-art"
    )
    assert (
        page.locator(".brand__mark").evaluate(
            "element => getComputedStyle(element).viewTransitionName"
        )
        == "brand-mark"
    )
    assert (
        page.locator(".how-card").evaluate(
            "element => getComputedStyle(element).animationName"
        )
        == "panel-enter"
    )

    page.evaluate(
        """() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            value: true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        }"""
    )
    assert (
        page.locator(".scene-clouds").evaluate(
            "element => getComputedStyle(element).animationPlayState"
        )
        == "paused"
    )
    page.evaluate(
        """() => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        }"""
    )
    assert (
        page.locator(".scene-clouds").evaluate(
            "element => getComputedStyle(element).animationPlayState"
        )
        == "running"
    )

    click_bird(page)
    wait_for_state(page, "flying")
    wait_for_state(page, "perched", timeout=6000)

    assert not console_errors


def test_audio_play_flaps_the_scene_bird(page, base_url, console_errors):
    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option", state="visible")

    audio = page.locator("[data-audio]")
    audio.evaluate("element => element.dispatchEvent(new Event('play'))")
    assert (
        page.locator("[data-scene-bird]").get_attribute("data-bird-audio") == "playing"
    )
    assert (
        page.locator("[data-scene-bird] .bird-wing").evaluate(
            "element => getComputedStyle(element).animationName"
        )
        == "bird-wingflap"
    )
    assert (
        page.locator("[data-audio-bird]").evaluate(
            "element => getComputedStyle(element).animationName"
        )
        == "audio-bird-bob"
    )

    audio.evaluate("element => element.dispatchEvent(new Event('pause'))")
    assert page.locator("[data-scene-bird]").get_attribute("data-bird-audio") == "idle"
    assert (
        page.locator("[data-audio-bird]").evaluate(
            "element => getComputedStyle(element).animationName"
        )
        == "none"
    )

    assert not console_errors


def test_winning_flies_the_bird_to_the_result(page, base_url, console_errors):
    answer, _ = answer_for("us")

    page.goto(f"{base_url}/normal/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option", state="visible")
    page.locator(".answer-option").filter(has_text=answer["name"]).click()
    page.wait_for_selector("[data-completion]:not([hidden])", state="attached")

    page.wait_for_selector(
        "[data-bird-actor].is-visible",
        state="attached",
        timeout=5000,
    )
    page.wait_for_selector(
        "[data-bird-actor].is-landed",
        state="attached",
        timeout=5000,
    )
    assert "is-dropping" in (
        page.locator("[data-bird-actor]").get_attribute("class") or ""
    )
    assert "is-away" in (page.locator("[data-scene-bird]").get_attribute("class") or "")

    page.wait_for_selector(
        "[data-bird-actor]:not(.is-visible)",
        state="attached",
        timeout=9000,
    )
    assert "is-away" not in (
        page.locator("[data-scene-bird]").get_attribute("class") or ""
    )

    assert not console_errors


def test_practice_mode_and_round_react(page, base_url, console_errors):
    page.goto(f"{base_url}/practice/?region=us", wait_until="networkidle")
    page.wait_for_selector(".answer-option", state="visible")

    page.locator("[data-practice-toggle]").click()
    wait_for_reaction(page, "mode", timeout=2000)

    page.locator("[data-practice-toggle]").click()
    page.wait_for_selector(".answer-option", state="visible")

    for _ in range(4):
        if page.locator("[data-completion]:not([hidden])").count():
            break
        page.locator(".answer-option").first.click()
        page.wait_for_timeout(150)

    page.wait_for_selector("[data-completion]:not([hidden])", state="attached")
    page.locator("[data-practice-next]").click()
    page.wait_for_selector(".answer-option", state="visible")
    wait_for_reaction(page, "round", timeout=2000)

    assert not console_errors


def test_hard_mode_hint_reacts(page, base_url, console_errors):
    answer, _ = answer_for("us")
    wrong = other_bird(answer["id"])

    page.goto(f"{base_url}/hard/?region=us", wait_until="networkidle")
    page.wait_for_selector("[data-hard-input]:not([disabled])", state="visible")
    page.fill("[data-hard-input]", wrong["name"])
    page.wait_for_selector(".suggestion", state="visible")
    page.locator(".suggestion").first.click()

    wait_for_reaction(page, "hint", timeout=5000)

    assert not console_errors


def test_reduced_motion_keeps_the_bird_still(browser, base_url):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        reduced_motion="reduce",
    )
    page = context.new_page()
    try:
        page.goto(f"{base_url}/", wait_until="networkidle")
        assert (
            page.locator(".scene-clouds").evaluate(
                "element => getComputedStyle(element).animationName"
            )
            == "none"
        )

        click_bird(page)
        page.wait_for_timeout(250)
        assert (
            page.locator("[data-scene-bird]").get_attribute("data-state") == "perched"
        )
        assert page.locator("[data-bird-actor]").count() == 0
    finally:
        context.close()


def test_toast_sends_the_bird_to_the_notification(page, base_url, console_errors):
    page.goto(f"{base_url}/", wait_until="networkidle")
    page.evaluate(
        """async () => {
          const base = document.querySelector('script[type="module"]').src.split('/js/')[0];
          const { notify } = await import(`${base}/js/ui/toast.js`);
          notify('Bird flight test');
        }"""
    )

    page.wait_for_selector(
        "[data-bird-actor].is-visible",
        state="attached",
        timeout=4000,
    )
    page.wait_for_selector(
        "[data-bird-actor]:not(.is-visible)",
        state="attached",
        timeout=9000,
    )

    assert not console_errors
