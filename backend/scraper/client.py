from __future__ import annotations

import httpx

from core.config import settings
from core.constants import BROWSER_HEADERS


class AcademiaClient:
    """HTTP client for talking to SRM Academia."""

    def __init__(self, cookie: str = "") -> None:
        self.cookie = cookie
        self._client = httpx.Client(
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0"},
            verify=False,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> AcademiaClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def get(self, url: str, headers: dict | None = None) -> httpx.Response:
        merged = dict(headers or {})
        if self.cookie:
            merged.setdefault("Cookie", self.cookie)
        return self._client.get(url, headers=merged)

    def post(
        self,
        url: str,
        data: dict | None = None,
        headers: dict | None = None,
        follow_redirects: bool = True,
    ) -> httpx.Response:
        merged = dict(headers or {})
        if self.cookie:
            merged.setdefault("Cookie", self.cookie)
        return self._client.post(
            url, data=data, headers=merged, follow_redirects=follow_redirects
        )

    def delete(self, url: str, headers: dict | None = None) -> httpx.Response:
        merged = dict(headers or {})
        if self.cookie:
            merged.setdefault("Cookie", self.cookie)
        return self._client.delete(url, headers=merged)

    def fetch_page(self, url: str) -> str:
        """Fetch an Academia data page with browser-like headers."""
        response = self.get(url, headers=BROWSER_HEADERS)
        print(f"[SCRAPER] Fetched {url} - status {response.status_code}")
        if response.status_code != 200:
            print(f"[SCRAPER] Response body: {response.text[:500]}")
        return response.text
