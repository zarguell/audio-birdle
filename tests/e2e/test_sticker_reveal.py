"""The species reveal shows a sticker and animates it on a win."""

from __future__ import annotations

import base64

import pytest

from .helpers import finish_normal_round

# A real 1x1 PNG, served for every sticker so the test proves the game built
# and used the URL without depending on the network.
_PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


@pytest.fixture
def stubbed_cdn(page):
    """Route the sticker CDN locally for this test only.

    Not a shared fixture: Playwright's request interception on a context aborts
    the navigation's View Transition, which other tests assert stays clean.
    This test navigates straight to a game page, so it has none to break.
    """
    page.route(
        "**/cdn.jsdelivr.net/**",
        lambda route: route.fulfill(
            status=200, content_type="image/png", body=_PIXEL
        ),
    )
    return page


def test_a_win_reveals_the_species_sticker(stubbed_cdn, base_url, console_errors):
    stubbed_cdn.goto(f"{base_url}/practice/?region=us", wait_until="networkidle")
    finish_normal_round(stubbed_cdn)

    sticker = stubbed_cdn.locator("[data-sticker-wrap]")
    image = stubbed_cdn.locator("[data-sticker]")
    sticker.wait_for(state="visible")

    # Proves the game built the taxonomy URL and requested it, not that the
    # internet happened to answer.
    src = image.get_attribute("src") or ""
    assert src.startswith("https://cdn.jsdelivr.net/"), src
    assert "/stickers/" in src and src.endswith(".webp"), src

    # CC BY requires the credit to travel with the art.
    assert stubbed_cdn.locator("[data-sticker-note]").is_visible()

    # The photo carousel is the fallback, so it gives way to the sticker.
    assert stubbed_cdn.locator("[data-image-carousel]").is_hidden()

    assert not console_errors


@pytest.mark.parametrize("reduced", [False, True])
def test_the_dance_is_skipped_when_motion_is_reduced(
    stubbed_cdn, base_url, reduced
):
    stubbed_cdn.emulate_media(reduced_motion="reduce" if reduced else "no-preference")
    stubbed_cdn.goto(f"{base_url}/practice/?region=us", wait_until="networkidle")
    finish_normal_round(stubbed_cdn)

    stubbed_cdn.locator("[data-sticker-wrap]").wait_for(state="visible")
    # The animation is attached from JS after the image loads.
    stubbed_cdn.wait_for_timeout(200)

    name = stubbed_cdn.locator("[data-sticker]").evaluate(
        "(el) => getComputedStyle(el).animationName"
    )
    assert name == ("none" if reduced else "sticker-dance")
