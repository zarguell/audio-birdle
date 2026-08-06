"""
Shared helpers for eBird API access.

Centralizes API-key loading and HTTP fetching so every eBird-facing script
gets consistent timeouts, retries with exponential backoff, and non-zero
failure behavior.

Retry policy: `retries` attempts total, sleeping 1s, 2s, 4s (2**attempt)
between attempts, and raising the last error on final failure.
"""

import os
import time

import requests
from dotenv import load_dotenv


def load_api_key():
    """Load the eBird API key from .env / the environment.

    Raises:
        ValueError: if EBIRD_API_KEY is not set anywhere.
    """
    load_dotenv()
    api_key = os.getenv("EBIRD_API_KEY")
    if not api_key:
        raise ValueError("EBIRD_API_KEY not found in .env")
    return api_key


def get(url, api_key=None, retries=3, timeout=30, params=None):
    """GET a URL with retries and exponential backoff.

    Args:
        url: Request URL.
        api_key: eBird API token; if set, sent as the X-eBirdApiToken header.
        retries: Number of attempts (default 3). Backoff between attempts is
            1s, 2s, 4s (2**attempt).
        timeout: Per-attempt timeout in seconds (default 30).
        params: Optional query parameters.

    Returns:
        requests.Response on success (HTTP 2xx).

    Raises:
        requests.RequestException: if every attempt fails (network error or
            non-2xx status after raise_for_status).
    """
    headers = {"X-eBirdApiToken": api_key} if api_key else {}
    last_error = None
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=timeout)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            last_error = e
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    raise last_error


def get_json(url, api_key=None, retries=3, timeout=30, params=None):
    """GET a URL and parse the response body as JSON (retries + backoff)."""
    return get(url, api_key=api_key, retries=retries, timeout=timeout, params=params).json()


def get_content(url, api_key=None, retries=3, timeout=30, params=None):
    """GET a URL and return the raw response body bytes (retries + backoff)."""
    return get(url, api_key=api_key, retries=retries, timeout=timeout, params=params).content
