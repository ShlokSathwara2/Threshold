from __future__ import annotations

from bs4 import BeautifulSoup

from core.config import settings
from core.schemas.models import LoginResponse, CaptchaData
from scraper.client import AcademiaClient


class AuthService:
    """Handle login, logout, and session management with SRM Academia."""

    def login(
        self,
        username: str,
        password: str,
        cdigest: str | None = None,
        captcha: str | None = None,
    ) -> LoginResponse:
        full_username = username if "@" in username else f"{username}@srmist.edu.in"

        with AcademiaClient() as client:
            return self._login_with_retry(
                client, full_username, password, cdigest, captcha, retry_count=0
            )

    def logout(self, cookie: str) -> dict:
        with AcademiaClient(cookie=cookie) as client:
            response = client.get(
                settings.logout_url, headers={"User-Agent": "Mozilla/5.0"}
            )
        return {
            "status": response.status_code,
            "success": response.status_code in {200, 302},
        }

    def cleanup(self, cookie: str) -> int:
        with AcademiaClient(cookie=cookie) as client:
            return client.delete(settings.active_sessions_url).status_code

    def _login_with_retry(
        self,
        client: AcademiaClient,
        username: str,
        password: str,
        cdigest: str | None,
        captcha: str | None,
        retry_count: int,
    ) -> LoginResponse:
        if retry_count > 2:
            return LoginResponse(
                False, status=401, message="Too many retries after concurrent session termination"
            )

        form = {
            "username": username,
            "password": password,
            "client_portal": "true",
            "portal": settings.portal_id,
            "servicename": settings.service_name,
            "serviceurl": f"{settings.academia_base_url}/",
            "is_ajax": "true",
            "grant_type": "password",
            "service_language": "en",
        }
        if cdigest:
            form["cdigest"] = cdigest
        if captcha:
            form["captcha"] = captcha

        response = client.post(
            settings.signin_url,
            data=form,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0",
                "Origin": settings.academia_base_url,
                "Referer": f"{settings.academia_base_url}/",
            },
            follow_redirects=False,
        )

        body = response.text
        lowered = body.lower()

        # Handle concurrent session — terminate and retry
        if ("concurrent" in lowered or "terminate" in lowered):
            if self._force_logout(client, body, response):
                return self._login_with_retry(
                    client, username, password, cdigest, captcha, retry_count + 1
                )

        try:
            payload = response.json()
        except Exception:
            return LoginResponse(
                False, status=response.status_code, message="Unexpected response from server"
            )

        # Handle errors
        error = payload.get("error")
        if isinstance(error, dict):
            return LoginResponse(False, status=401, message=error.get("msg", ""))

        # Handle captcha requirement
        if payload.get("status") == "fail" and payload.get("code") in {
            "HIP_REQUIRED", "HIP_FAILED",
        }:
            captcha_data = None
            if payload.get("cdigest"):
                captcha_data = CaptchaData(
                    image=settings.captcha_url.replace("{cdigest}", payload["cdigest"]),
                    cdigest=payload["cdigest"],
                )
            return LoginResponse(
                False, status=401, message=payload.get("message"), captcha=captcha_data
            )

        # Extract access token and follow redirect to establish session
        inner = payload.get("data")
        if not isinstance(inner, dict):
            return LoginResponse(
                False, status=401, message=payload.get("message", "Invalid credentials")
            )

        access_token = inner.get("access_token")
        redirect_url = inner.get("oauthorize_uri")
        if not access_token or not redirect_url:
            return LoginResponse(False, status=401, message="Missing tokens in response")

        # Follow the redirect to establish JSESSIONID
        jar = CookieJar()
        jar.update_from_response(response.headers.get_list("set-cookie"))

        auth_response = client.get(
            f"{redirect_url}&access_token={access_token}",
            headers={"Cookie": jar.header()},
        )
        jar.update_from_response(auth_response.headers.get_list("set-cookie"))
        cookie_header = jar.header()

        if "JSESSIONID" not in cookie_header:
            return LoginResponse(False, status=401, message="Session failed: JSESSIONID not established")

        return LoginResponse(
            True,
            status=200,
            message="Success",
            cookies=cookie_header,
        )

    def _force_logout(
        self, client: AcademiaClient, html: str, original_response
    ) -> bool:
        """Handle concurrent session by terminating the existing one."""
        soup = BeautifulSoup(html, "lxml")
        terminate_form = None
        for form in soup.find_all("form"):
            if "terminate" in form.get_text(" ", strip=True).lower():
                terminate_form = form
                break

        if terminate_form is None:
            return False

        action = terminate_form.get("action") or ""
        if not action.startswith("http"):
            action = f"{settings.academia_base_url}{action}"

        jar = CookieJar()
        jar.update_from_response(original_response.headers.get_list("set-cookie"))

        payload = {
            field.get("name"): field.get("value", "")
            for field in terminate_form.find_all("input")
            if field.get("name")
        }

        response = client.post(
            action,
            data=payload,
            headers={
                "Cookie": jar.header(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        return response.status_code == 200


class CookieJar:
    """Simple cookie jar to accumulate Set-Cookie headers."""

    def __init__(self) -> None:
        self.cookies: dict[str, str] = {}

    def update_from_response(self, set_cookie_headers: list[str]) -> None:
        for header in set_cookie_headers:
            parts = header.split(";")[0].strip()
            if "=" in parts:
                key, value = parts.split("=", 1)
                self.cookies[key.strip()] = value.strip()

    def header(self) -> str:
        return "; ".join(f"{k}={v}" for k, v in self.cookies.items())
