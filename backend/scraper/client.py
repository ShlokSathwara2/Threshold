from __future__ import annotations

import httpx

from core.constants import BROWSER_HEADERS
from core.markup import decode_sanitize_html


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

    def fetch_page(self, url: str) -> str:
        """Fetch an Academia data page with browser-like headers.

        Note: we deliberately do NOT re-visit the portal root page here.
        The login flow (AuthService) already establishes full session
        context (JSESSIONID + portal-root visit) once at login time.
        Re-hitting the portal root before every data fetch was causing
        Zoho Creator to reject the specific page (403 "Page is not
        accessible") even though the broader session was still valid.
        """
        print(f"[SCRAPER] Cookies before fetch: {list(self._client.cookies.keys())}")
        response = self.get(url, headers=BROWSER_HEADERS)
        print(f"[SCRAPER] Fetched {url} - status {response.status_code}")
        if response.status_code != 200:
            print(f"[SCRAPER] Response body: {response.text[:500]}")
        return decode_sanitize_html(response.text)
