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
        # Load cookies into the httpx cookie jar
        if cookie:
            for pair in cookie.split(";"):
                pair = pair.strip()
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    self._client.cookies.set(k.strip(), v.strip())

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> AcademiaClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def get(self, url: str, headers: dict | None = None) -> httpx.Response:
        return self._client.get(url, headers=headers or {})

    def post(
        self,
        url: str,
        data: dict | None = None,
        headers: dict | None = None,
        follow_redirects: bool = True,
    ) -> httpx.Response:
        return self._client.post(
            url, data=data, headers=headers or {}, follow_redirects=follow_redirects
        )

    def delete(self, url: str, headers: dict | None = None) -> httpx.Response:
        return self._client.delete(url, headers=headers or {})

    def _init_session(self) -> None:
        """Visit the main portal page to establish the Zoho Creator session context."""
        init_url = f"{settings.academia_base_url}/srm_university/academia-academic-services/"
        nav_headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": BROWSER_HEADERS["User-Agent"],
            "Referer": f"{settings.academia_base_url}/",
        }
        response = self.get(init_url, headers=nav_headers)
        print(f"[SCRAPER] Session init: {response.status_code} from {init_url}")
        print(f"[SCRAPER] Session init cookies: {dict(self._client.cookies)}")

    def fetch_page(self, url: str) -> str:
        """Fetch an Academia data page with browser-like headers."""
        self._init_session()
        print(f"[SCRAPER] Cookies before fetch: {list(self._client.cookies.keys())}")
        response = self.get(url, headers=BROWSER_HEADERS)
        print(f"[SCRAPER] Fetched {url} - status {response.status_code}")
        if response.status_code != 200:
            print(f"[SCRAPER] Response body: {response.text[:500]}")
        return response.text
