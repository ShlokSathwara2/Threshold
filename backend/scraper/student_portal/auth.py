from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from core.config import settings
from core.schemas.models import LoginResponse


class StudentPortalAuth:
    """Handle login and session management with SRM Student Portal."""

    def login(self, username: str, password: str) -> LoginResponse:
        netid = username.split("@")[0] if "@" in username else username
        print(f"[SP-LOGIN] Attempting login for NetID: {netid}")

        try:
            return self._do_login(netid, password)
        except Exception as e:
            print(f"[SP-LOGIN] Exception: {e}")
            import traceback
            traceback.print_exc()
            raise

    def _do_login(self, netid: str, password: str) -> LoginResponse:
        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
            # Step 1: GET login page — parse SECURE_CONFIG + honeypot field
            login_page = client.get(settings.sp_login_page_url)
            if login_page.status_code != 200:
                return LoginResponse(
                    success=False, status=login_page.status_code,
                    message="Failed to load Student Portal login page"
                )

            html = login_page.text
            soup = BeautifulSoup(html, "lxml")

            # Extract CAPTCHA text from SECURE_CONFIG
            captcha_text = self._extract_captcha_text(html)
            if not captcha_text:
                return LoginResponse(
                    success=False, status=500,
                    message="Could not extract CAPTCHA from login page"
                )
            print(f"[SP-LOGIN] Auto-solved CAPTCHA: {captcha_text}")

            # Extract honeypot field name (ph_XXXXXXXX)
            honeypot_name = self._extract_honeypot_name(soup)
            print(f"[SP-LOGIN] Honeypot field: {honeypot_name}")

            # Extract hidden fields
            challenge_id = self._extract_hidden_value(soup, "challengeId")
            fp_nonce = self._extract_hidden_value(soup, "fpNonce")

            # Step 2: POST login
            form_data = {
                "username": netid,
                "password": password,
                "captcha": captcha_text,
                "fpPayload": "{}",
                "fpToken": "",
            }
            if honeypot_name:
                form_data[honeypot_name] = ""
            if challenge_id:
                form_data["challengeId"] = challenge_id
            if fp_nonce:
                form_data["fpNonce"] = fp_nonce

            response = client.post(
                settings.sp_login_url,
                data=form_data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0",
                    "Origin": settings.sp_base_url,
                    "Referer": settings.sp_login_page_url,
                },
                follow_redirects=True,
            )

            print(f"[SP-LOGIN] POST status: {response.status_code}")
            print(f"[SP-LOGIN] Final URL: {response.url}")
            print(f"[SP-LOGIN] Cookies: {dict(client.cookies)}")

            # Login success = redirected away from login page to dashboard/HRDSystem
            final_url = str(response.url).lower()
            resp_html = response.text.lower()

            is_on_login_page = "youlogin" in final_url or "login" in final_url
            has_login_form = 'id="login_form"' in resp_html

            if is_on_login_page and has_login_form:
                # Still on login page — check for specific error messages
                # Look for error text inside error divs (not CSS class names)
                if 'class="alert' in resp_html and ("invalid" in resp_html or "incorrect" in resp_html):
                    return LoginResponse(
                        success=False, status=401,
                        message="Invalid NetID or password"
                    )
                if "captcha" in resp_html and "mismatch" in resp_html:
                    return LoginResponse(
                        success=False, status=401,
                        message="CAPTCHA verification failed"
                    )
                # Still on login page but no specific error — could be any issue
                return LoginResponse(
                    success=False, status=401,
                    message="Login failed — still on login page"
                )

            # Build cookie header from httpx's cookie jar
            cookie_header = "; ".join(f"{k}={v}" for k, v in client.cookies.items())

            if not cookie_header:
                return LoginResponse(
                    success=False, status=401,
                    message="No session cookies established"
                )

            # Verify session by fetching attendance page
            test_response = client.get(
                settings.sp_attendance_url,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            print(f"[SP-LOGIN] Session test (attendance page): {test_response.status_code}")

            if test_response.status_code != 200:
                return LoginResponse(
                    success=False, status=401,
                    message="Session establishment failed"
                )

            print(f"[SP-LOGIN] Success! Cookie length: {len(cookie_header)}")
            return LoginResponse(
                success=True,
                status=200,
                message="Success",
                cookies=cookie_header,
            )

    def _extract_captcha_text(self, html: str) -> str | None:
        """Extract captchaText from SECURE_CONFIG in HTML."""
        match = re.search(r"captchaText\s*=\s*['\"]([^'\"]+)['\"]", html)
        return match.group(1) if match else None

    def _extract_honeypot_name(self, soup: BeautifulSoup) -> str | None:
        """Extract the dynamic honeypot field name (ph_XXXXXXXX)."""
        for inp in soup.find_all("input", attrs={"type": "text"}):
            name = inp.get("name", "")
            if re.match(r"^ph_[a-f0-9]+$", name):
                return name
        return None

    def _extract_hidden_value(self, soup: BeautifulSoup, field_id: str) -> str | None:
        """Extract value from a hidden input by its ID."""
        inp = soup.find("input", attrs={"id": field_id})
        return inp.get("value") if inp else None

    def logout(self, cookie: str) -> dict:
        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
            for pair in cookie.split(";"):
                if "=" in pair:
                    k, v = pair.strip().split("=", 1)
                    client.cookies.set(k.strip(), v.strip())
            # Student Portal logout URL pattern
            response = client.get(
                f"{settings.sp_base_url}{settings.sp_context_path}/Logout",
                headers={"User-Agent": "Mozilla/5.0"},
            )
        return {
            "status": response.status_code,
            "success": response.status_code in {200, 302},
        }
