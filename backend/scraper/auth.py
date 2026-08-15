from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

from core.config import settings
from core.schemas.models import LoginResponse, CaptchaData


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
        print(f"[LOGIN] Attempting login for {full_username}")

        try:
            return self._login_with_retry(full_username, password, cdigest, captcha, retry_count=0)
        except Exception as e:
            print(f"[LOGIN] Exception: {e}")
            import traceback
            traceback.print_exc()
            raise

    def _login_with_retry(
        self,
        username: str,
        password: str,
        cdigest: str | None,
        captcha: str | None,
        retry_count: int,
    ) -> LoginResponse:
        if retry_count > 2:
            return LoginResponse(
                success=False, status=401, message="Too many retries after concurrent session termination"
            )

        # Use a single httpx client with cookie tracking
        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
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

            # Step 1: POST login credentials
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
            print(f"[LOGIN] POST status: {response.status_code}")

            # Handle concurrent session
            if "concurrent" in lowered or "terminate" in lowered:
                print("[LOGIN] Concurrent session detected, terminating...")
                if self._force_logout(client, body):
                    return self._login_with_retry(username, password, cdigest, captcha, retry_count + 1)

            try:
                payload = response.json()
            except Exception:
                print(f"[LOGIN] Non-JSON response: {body[:500]}")
                return LoginResponse(
                    success=False, status=response.status_code, message="Unexpected response from server"
                )

            # Handle errors
            error = payload.get("error")
            if isinstance(error, dict):
                return LoginResponse(success=False, status=401, message=error.get("msg", ""))

            # Handle captcha
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
                    success=False, status=401, message=payload.get("message"), captcha=captcha_data
                )

            # Extract access token and follow redirect
            inner = payload.get("data")
            if not isinstance(inner, dict):
                return LoginResponse(
                    success=False, status=401, message=payload.get("message", "Invalid credentials")
                )

            access_token = inner.get("access_token")
            redirect_url = inner.get("oauthorize_uri")
            if not access_token or not redirect_url:
                return LoginResponse(success=False, status=401, message="Missing tokens in response")

            # Step 2: Follow authorize redirect (establishes JSESSIONID)
            auth_response = client.get(
                f"{redirect_url}&access_token={access_token}",
                follow_redirects=True,
            )
            print(f"[LOGIN] Auth redirect final status: {auth_response.status_code}")
            print(f"[LOGIN] Cookies after auth: {dict(client.cookies)}")

            # Step 3: Hit the main portal page to establish full session
            # This is what a browser does - it navigates to the portal home first
            portal_response = client.get(
                f"{settings.academia_base_url}/srm_university/academia-academic-services/",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            print(f"[LOGIN] Portal page status: {portal_response.status_code}")
            print(f"[LOGIN] Final cookies: {dict(client.cookies)}")

            # Build cookie header string
            cookie_header = "; ".join(f"{k}={v}" for k, v in client.cookies.items())

            if "JSESSIONID" not in cookie_header:
                print(f"[LOGIN] WARNING: No JSESSIONID in cookie header!")
                print(f"[LOGIN] Cookie header: {cookie_header[:500]}")
                return LoginResponse(success=False, status=401, message="Session failed: JSESSIONID not established")

            print(f"[LOGIN] Success! Cookie header length: {len(cookie_header)}")
            return LoginResponse(
                success=True,
                status=200,
                message="Success",
                cookies=cookie_header,
            )

    def _force_logout(self, client: httpx.Client, html: str) -> bool:
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

        payload = {
            field.get("name"): field.get("value", "")
            for field in terminate_form.find_all("input")
            if field.get("name")
        }

        response = client.post(
            action,
            data=payload,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        return response.status_code == 200

    def logout(self, cookie: str) -> dict:
        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
            for pair in cookie.split(";"):
                if "=" in pair:
                    k, v = pair.strip().split("=", 1)
                    client.cookies.set(k.strip(), v.strip())
            response = client.get(
                settings.logout_url, headers={"User-Agent": "Mozilla/5.0"}
            )
        return {
            "status": response.status_code,
            "success": response.status_code in {200, 302},
        }
