"""Shared fixtures for browser end-to-end tests.

The site is built with the real Python generator and served from a temporary
directory. A tiny ``_headers`` parser applies the same cache/security rules
that Cloudflare will apply in production, so cache regressions are testable
locally.
"""

# Pytest fixtures intentionally shadow their factory names.
# pylint: disable=redefined-outer-name

from __future__ import annotations

import functools
import http.server
import logging
import threading
import urllib.parse
from pathlib import Path
from typing import Iterator

import pytest
from playwright.sync_api import Browser, Page, sync_playwright

from sitegen.build import build_site


def parse_headers(path: Path) -> list[tuple[str, dict[str, str]]]:
    rules: list[tuple[str, dict[str, str]]] = []
    current: dict[str, str] | None = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        if not raw_line.strip():
            current = None
            continue
        if raw_line.lstrip().startswith("#"):
            continue
        if raw_line.startswith((" ", "\t")):
            _add_header(current, raw_line)
            continue
        current = {}
        rules.append((raw_line.strip(), current))
    return rules


def _add_header(current: dict[str, str] | None, raw_line: str) -> None:
    if current is None:
        return
    key, _, value = raw_line.strip().partition(":")
    current[key] = value.strip()


def rule_matches(pattern: str, path: str) -> bool:
    if pattern == "/*":
        return True
    if pattern.endswith("*"):
        return path.startswith(pattern[:-1])
    return path == pattern


def resolve_headers(
    rules: list[tuple[str, dict[str, str]]], path: str
) -> dict[str, str]:
    headers: dict[str, str] = {}
    for pattern, values in rules:
        if not rule_matches(pattern, path):
            continue
        _apply_header_values(headers, values)
    return headers


def _apply_header_values(headers: dict[str, str], values: dict[str, str]) -> None:
    for key, value in values.items():
        if key.startswith("! "):
            headers.pop(key[2:].strip(), None)
        else:
            headers[key] = value


def make_handler(directory: Path, rules: list[tuple[str, dict[str, str]]]):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self) -> None:
            path = urllib.parse.urlsplit(self.path).path
            for key, value in resolve_headers(rules, path).items():
                self.send_header(key, value)
            super().end_headers()

        def send_error(self, code, message=None, explain=None) -> None:  # noqa: ANN001
            if code == 404:
                body = (directory / "404.html").read_bytes()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().send_error(code, message, explain)

        def log_message(self, *_args: object) -> None:
            logging.getLogger("audio-birdle.e2e").debug("%s", _args)

    return functools.partial(Handler, directory=str(directory))


@pytest.fixture(scope="session")
def built_site(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("audio-birdle-site")
    build_site(output)
    return output


class TestServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 128


@pytest.fixture(scope="session")
def base_url(built_site: Path) -> Iterator[str]:
    rules = parse_headers(built_site / "_headers")
    server = TestServer(
        ("127.0.0.1", 0),
        make_handler(built_site, rules),
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    try:
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


@pytest.fixture(scope="session")
def browser() -> Iterator[Browser]:
    with sync_playwright() as playwright:
        browser_instance = playwright.chromium.launch()
        try:
            yield browser_instance
        finally:
            browser_instance.close()


@pytest.fixture
def page(browser: Browser) -> Iterator[Page]:
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        locale="en-US",
        timezone_id="UTC",
    )
    page = context.new_page()
    try:
        yield page
    finally:
        context.close()


# Third-party media the game loads by design: sticker art from the jsDelivr CDN
# and bird audio from xeno-canto and the Cornell Macaulay library. The suite runs
# with no network, so a request to any of these fails every time and the browser
# logs "Failed to load resource". That is the sandbox, not our code, so those
# lines are filtered; page errors and our own console errors still fail the test.
_REMOTE_MEDIA_HOSTS = (
    "cdn.jsdelivr.net",
    "xeno-canto.org",
    "cdn.download.ams.birds.cornell.edu",
)


def _is_remote_media_failure(message) -> bool:  # noqa: ANN001
    if message.type != "error":
        return False
    if not message.text.startswith("Failed to load resource"):
        return False
    url = (message.location or {}).get("url", "")
    return any(host in url for host in _REMOTE_MEDIA_HOSTS)


@pytest.fixture
def console_errors(page: Page) -> list[str]:
    errors: list[str] = []

    def on_page_error(error: Exception) -> None:
        errors.append(f"pageerror: {error}")

    def on_console(message) -> None:  # noqa: ANN001
        if message.type == "error" and not _is_remote_media_failure(message):
            errors.append(f"console: {message.text}")

    page.on("pageerror", on_page_error)
    page.on("console", on_console)
    return errors


def pytest_collection_modifyitems(items) -> None:  # noqa: ANN001
    """Mark browser tests so the fast Python suite can exclude them."""
    e2e_dir = Path(__file__).resolve().parent
    for item in items:
        if e2e_dir in item.path.parents or item.path.parent == e2e_dir:
            item.add_marker(pytest.mark.e2e)
