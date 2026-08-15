from __future__ import annotations

import base64
import re
import time

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
            # Step 1: GET login page — parse SECURE_CONFIG + form fields
            login_page = client.get(settings.sp_login_page_url)
            if login_page.status_code != 200:
                return LoginResponse(
                    success=False, status=login_page.status_code,
                    message="Failed to load Student Portal login page"
                )

            html = login_page.text
            soup = BeautifulSoup(html, "lxml")

            # Extract SECURE_CONFIG values
            captcha_text = self._extract_captcha_text(html)
            domain_field_name = self._extract_config_value(html, "domainFieldName")
            captcha_field_name = self._extract_config_value(html, "captchaFieldName")
            session_nonce = self._extract_config_value(html, "nonce")
            random_delimiter = self._extract_config_value(html, "randomDelimiter")

            if not captcha_text:
                return LoginResponse(
                    success=False, status=500,
                    message="Could not extract CAPTCHA from login page"
                )
            print(f"[SP-LOGIN] CAPTCHA: {captcha_text}")
            print(f"[SP-LOGIN] domainFieldName: {domain_field_name}")
            print(f"[SP-LOGIN] captchaFieldName: {captcha_field_name}")
            print(f"[SP-LOGIN] nonce: {session_nonce}")

            # Extract honeypot field name (ph_XXXXXXXX)
            honeypot_name = self._extract_honeypot_name(soup)
            print(f"[SP-LOGIN] Honeypot: {honeypot_name}")

            # Extract hidden fields
            challenge_id = self._extract_hidden_value(soup, "challengeId")
            fp_nonce = self._extract_hidden_value(soup, "fpNonce")

            # Step 2: Compute the two security tokens (from guardlogin.js)
            # Token 1: domain token = base64(reversed_hostname)
            hostname = "sp.srmist.edu.in"
            reversed_hostname = hostname[::-1]
            domain_token = base64.b64encode(reversed_hostname.encode()).decode()
            print(f"[SP-LOGIN] domain_token: {domain_token}")

            # Token 2: captcha token = base64(timeElapsed + sessionNonce + interactCount)
            # Time elapsed since page load — use a small value
            time_elapsed = 2
            interact_count = 1  # at least one interaction (page loaded)
            if session_nonce:
                captcha_token_str = f"{time_elapsed}{random_delimiter or ''}{session_nonce}"
            else:
                captcha_token_str = f"{time_elapsed}"
            captcha_token = base64.b64encode(captcha_token_str.encode()).decode()
            print(f"[SP-LOGIN] captcha_token: {captcha_token}")

            # Step 3: Compute fpPayload and fpToken (from secure2.js)
            fp_payload = self._compute_fp_payload()
            fp_token = self._compute_fp_token()

            # Step 4: POST login
            form_data = {
                "username": netid,
                "password": password,
                "captcha": captcha_text,
                "fpPayload": fp_payload,
                "fpToken": fp_token,
            }
            # Add the domain token field (dynamic name)
            if domain_field_name:
                form_data[domain_field_name] = domain_token
            # Add the captcha token field (dynamic name)
            if captcha_field_name:
                form_data[captcha_field_name] = captcha_token
            # Add honeypot (must be empty)
            if honeypot_name:
                form_data[honeypot_name] = ""
            if challenge_id:
                form_data["challengeId"] = challenge_id
            if fp_nonce:
                form_data["fpNonce"] = fp_nonce

            print(f"[SP-LOGIN] Form fields: {list(form_data.keys())}")

            response = client.post(
                settings.sp_login_url,
                data=form_data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
                    "Origin": settings.sp_base_url,
                    "Referer": settings.sp_login_page_url,
                },
                follow_redirects=True,
            )

            print(f"[SP-LOGIN] POST status: {response.status_code}")
            print(f"[SP-LOGIN] Final URL: {response.url}")
            print(f"[SP-LOGIN] Cookies: {dict(client.cookies)}")

            # Check for login failure
            final_url = str(response.url).lower()
            resp_html = response.text.lower()
            is_on_login_page = "youlogin" in final_url or "login" in final_url
            has_login_form = 'id="login_form"' in resp_html

            if is_on_login_page and has_login_form:
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
                return LoginResponse(
                    success=False, status=401,
                    message="Login failed — still on login page"
                )

            # Build cookie header
            cookie_header = "; ".join(f"{k}={v}" for k, v in client.cookies.items())

            if not cookie_header:
                return LoginResponse(
                    success=False, status=401,
                    message="No session cookies established"
                )

            print(f"[SP-LOGIN] Success! Cookie length: {len(cookie_header)}")
            return LoginResponse(
                success=True,
                status=200,
                message="Success",
                cookies=cookie_header,
            )

    def _extract_captcha_text(self, html: str) -> str | None:
        match = re.search(r"captchaText\s*=\s*['\"]([^'\"]+)['\"]", html)
        return match.group(1) if match else None

    def _extract_config_value(self, html: str, key: str) -> str | None:
        match = re.search(rf"{key}\s*=\s*['\"]([^'\"]+)['\"]", html)
        return match.group(1) if match else None

    def _extract_honeypot_name(self, soup: BeautifulSoup) -> str | None:
        for inp in soup.find_all("input", attrs={"type": "text"}):
            name = inp.get("name", "")
            if re.match(r"^ph_[a-f0-9]+$", name):
                return name
        return None

    def _extract_hidden_value(self, soup: BeautifulSoup, field_id: str) -> str | None:
        inp = soup.find("input", attrs={"id": field_id})
        return inp.get("value") if inp else None

    def _compute_fp_payload(self) -> str:
        """Compute a minimal but realistic fpPayload (from secure2.js)."""
        import json
        payload = {
            "E": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "D": 1920,
            "C": 1080,
            "B": -330,
            "z": 3,
            "y": 5,
            "x": 1,
            "w": 1500,
            "v": False,
            "u": "a1b2c3d4e5",
        }
        return json.dumps(payload)

    def _compute_fp_token(self) -> str:
        """Compute a minimal fpToken (canvas fingerprint hash from secure2.js)."""
        return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def logout(self, cookie: str) -> dict:
        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
            for pair in cookie.split(";"):
                if "=" in pair:
                    k, v = pair.strip().split("=", 1)
                    client.cookies.set(k.strip(), v.strip())
            response = client.get(
                f"{settings.sp_base_url}{settings.sp_context_path}/Logout",
                headers={"User-Agent": "Mozilla/5.0"},
            )
        return {
            "status": response.status_code,
            "success": response.status_code in {200, 302},
        }
