from __future__ import annotations

import base64
import json
import re
import time
import uuid
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup

from core.config import settings
from core.schemas.models import LoginResponse

_SESSION_TTL = 300  # seconds


@dataclass
class _LoginSessionState:
    client_cookies: dict[str, str]
    domain_field: str | None
    captcha_field: str | None
    nonce: str | None
    honeypot_name: str | None
    challenge_id: str | None
    fp_nonce: str | None
    captcha_answer: str  # SECURE_CONFIG captchaText (server-side answer, for debug)
    created_at: float = field(default_factory=time.time)


_pending_logins: dict[str, _LoginSessionState] = {}


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

    # ── Two-step login (CAPTCHA flow) ────────────────────────────────

    def start_login(self, username: str) -> dict:
        """Step A: load login page, download CAPTCHA image, store state."""
        netid = username.split("@")[0] if "@" in username else username
        print(f"[SP-LOGIN-INIT] Starting login for NetID: {netid}")

        # Evict expired sessions
        now = time.time()
        expired = [k for k, v in _pending_logins.items() if now - v.created_at > _SESSION_TTL]
        for k in expired:
            _pending_logins.pop(k, None)

        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
            login_page = client.get(
                settings.sp_login_page_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/138.0.0.0 Safari/537.36"
                    ),
                },
            )
            if login_page.status_code != 200:
                return {"success": False, "status": login_page.status_code,
                        "message": "Failed to load Student Portal login page"}

            html = login_page.text
            soup = BeautifulSoup(html, "lxml")

            config = self._extract_secure_config(html)
            print(f"[SP-LOGIN-INIT] SECURE_CONFIG: {config}")

            captcha_text = config.get("captchaText")
            if not captcha_text:
                return {"success": False, "status": 500,
                        "message": "Could not extract CAPTCHA from login page"}

            domain_field = config.get("domainFieldName")
            captcha_field = config.get("captchaFieldName")
            nonce = config.get("nonce")
            honeypot_name = self._extract_honeypot_name(soup)
            challenge_id = self._extract_hidden_value(soup, "challengeId")
            fp_nonce = self._extract_hidden_value(soup, "fpNonce")

            # Download CAPTCHA image
            captcha_img_url = self._extract_captcha_image_url(soup)
            captcha_b64 = ""
            if captcha_img_url:
                print(f"[SP-LOGIN-INIT] Loading CAPTCHA image: {captcha_img_url}")
                img_resp = client.get(captcha_img_url, headers={"User-Agent": "Mozilla/5.0"})
                print(f"[SP-LOGIN-INIT] CAPTCHA image status: {img_resp.status_code}")
                if img_resp.status_code == 200:
                    captcha_b64 = base64.b64encode(img_resp.content).decode()

            # Snapshot cookies from the GET response
            cookies_snapshot = dict(client.cookies.items())

        session_id = uuid.uuid4().hex
        _pending_logins[session_id] = _LoginSessionState(
            client_cookies=cookies_snapshot,
            domain_field=domain_field,
            captcha_field=captcha_field,
            nonce=nonce,
            honeypot_name=honeypot_name,
            challenge_id=challenge_id,
            fp_nonce=fp_nonce,
            captcha_answer=captcha_text,
        )

        print(f"[SP-LOGIN-INIT] Session {session_id} stored, CAPTCHA image length={len(captcha_b64)}")
        return {"success": True, "session_id": session_id, "captcha_image_base64": captcha_b64}

    def finish_login(self, session_id: str, username: str, password: str, captcha_answer: str) -> LoginResponse:
        """Step B: resume login with user-supplied CAPTCHA answer."""
        state = _pending_logins.pop(session_id, None)
        if state is None:
            return LoginResponse(success=False, status=400, message="Session expired or invalid. Restart login.")
        if time.time() - state.created_at > _SESSION_TTL:
            return LoginResponse(success=False, status=400, message="Session expired. Restart login.")

        netid = username.split("@")[0] if "@" in username else username
        print(f"[SP-LOGIN-VERIFY] Resuming login for NetID: {netid}, session {session_id}")

        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
            # Replay saved cookies
            for k, v in state.client_cookies.items():
                client.cookies.set(k, v)

            # Compute security tokens
            hostname = "sp.srmist.edu.in"
            domain_token = base64.b64encode(hostname[::-1].encode()).decode()

            time_elapsed = 2
            interact_count = 1
            captcha_token_raw = f"{time_elapsed}{state.nonce or ''}{interact_count}"
            captcha_token = base64.b64encode(captcha_token_raw.encode()).decode()

            # Build form data — use the user's captcha_answer
            form_data: dict[str, str] = {
                "username": netid,
                "password": password,
                "captcha": captcha_answer,
            }
            if state.domain_field:
                form_data[state.domain_field] = domain_token
            if state.captcha_field:
                form_data[state.captcha_field] = captcha_token
            if state.honeypot_name:
                form_data[state.honeypot_name] = ""
            if state.challenge_id:
                form_data["challengeId"] = state.challenge_id
            if state.fp_nonce:
                form_data["fpNonce"] = state.fp_nonce

            print(f"[SP-LOGIN-VERIFY] Form fields: {list(form_data.keys())}")

            response = client.post(
                settings.sp_login_url,
                data=form_data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/138.0.0.0 Safari/537.36"
                    ),
                    "Origin": settings.sp_base_url,
                    "Referer": settings.sp_login_page_url,
                },
                follow_redirects=True,
            )

            print(f"[SP-LOGIN-VERIFY] POST status: {response.status_code}")
            print(f"[SP-LOGIN-VERIFY] Final URL: {response.url}")

            final_url = str(response.url).lower()
            resp_html = response.text.lower()
            is_on_login_page = "youlogin" in final_url or (
                "login" in final_url and "template" not in final_url
            )
            has_login_form = 'id="login_form"' in resp_html

            if is_on_login_page and has_login_form:
                body = response.text
                error_msg = "Login failed"
                if "invalid" in body.lower() and ("password" in body.lower() or "netid" in body.lower()):
                    error_msg = "Invalid NetID or password"
                elif "captcha" in body.lower() and ("mismatch" in body.lower() or "invalid" in body.lower()):
                    error_msg = "CAPTCHA verification failed"
                elif "too many" in body.lower():
                    error_msg = "Too many login attempts"

                resp_snippet = response.text[:1000].replace("\n", " ")
                return LoginResponse(
                    success=False, status=401,
                    message=f"{error_msg} | url={str(response.url)} | resp_snippet={resp_snippet}",
                )

            cookie_header = "; ".join(f"{k}={v}" for k, v in client.cookies.items())

            if not cookie_header:
                return LoginResponse(success=False, status=401, message="No session cookies established")

            print(f"[SP-LOGIN-VERIFY] Success! Cookie length: {len(cookie_header)}")
            return LoginResponse(success=True, status=200, message="Success", cookies=cookie_header)

    def _do_login(self, netid: str, password: str) -> LoginResponse:
        with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
            # Step 1: GET login page
            login_page = client.get(
                settings.sp_login_page_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/138.0.0.0 Safari/537.36"
                    ),
                },
            )
            if login_page.status_code != 200:
                return LoginResponse(
                    success=False, status=login_page.status_code,
                    message="Failed to load Student Portal login page",
                )

            html = login_page.text
            soup = BeautifulSoup(html, "lxml")

            # Extract all SECURE_CONFIG values
            config = self._extract_secure_config(html)
            print(f"[SP-LOGIN] SECURE_CONFIG: {config}")

            captcha_text = config.get("captchaText")
            domain_field = config.get("domainFieldName")
            captcha_field = config.get("captchaFieldName")
            nonce = config.get("nonce")
            random_delim = config.get("randomDelimiter")

            if not captcha_text:
                return LoginResponse(
                    success=False, status=500,
                    message="Could not extract CAPTCHA from login page",
                )

            # Extract honeypot field name
            honeypot_name = self._extract_honeypot_name(soup)
            challenge_id = self._extract_hidden_value(soup, "challengeId")
            fp_nonce = self._extract_hidden_value(soup, "fpNonce")

            print(f"[SP-LOGIN] CAPTCHA: {captcha_text}")
            print(f"[SP-LOGIN] domain_field: {domain_field}")
            print(f"[SP-LOGIN] captcha_field: {captcha_field}")
            print(f"[SP-LOGIN] nonce: {nonce}")
            print(f"[SP-LOGIN] honeypot: {honeypot_name}")

            # Step 1b: Load the CAPTCHA image (server requires it to be loaded)
            captcha_img_url = self._extract_captcha_image_url(soup)
            if captcha_img_url:
                print(f"[SP-LOGIN] Loading CAPTCHA image: {captcha_img_url}")
                img_resp = client.get(captcha_img_url, headers={"User-Agent": "Mozilla/5.0"})
                print(f"[SP-LOGIN] CAPTCHA image status: {img_resp.status_code}")

            # Compute security tokens (replicating guardlogin.js)
            hostname = "sp.srmist.edu.in"
            domain_token = base64.b64encode(hostname[::-1].encode()).decode()

            time_elapsed = 2
            interact_count = 1
            captcha_token_raw = f"{time_elapsed}{nonce or ''}{interact_count}"
            captcha_token = base64.b64encode(captcha_token_raw.encode()).decode()

            # Compute fpPayload (replicating secure2.js telemetry)
            fp_payload = json.dumps({
                "E": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/138.0.0.0 Safari/537.36"
                ),
                "D": 1920, "C": 1080, "B": -330,
                "z": 3, "y": 5, "x": 1, "w": 1500,
                "v": False,
                "u": "a1b2c3d4e5",
            })
            fp_token = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

            # Build form data — minimal fields only
            form_data: dict[str, str] = {
                "username": netid,
                "password": password,
                "captcha": captcha_text,
            }
            if domain_field:
                form_data[domain_field] = domain_token
            if captcha_field:
                form_data[captcha_field] = captcha_token
            if honeypot_name:
                form_data[honeypot_name] = ""
            if challenge_id:
                form_data["challengeId"] = challenge_id
            if fp_nonce:
                form_data["fpNonce"] = fp_nonce

            print(f"[SP-LOGIN] Form fields: {list(form_data.keys())}")

            # Step 2: POST login
            response = client.post(
                settings.sp_login_url,
                data=form_data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/138.0.0.0 Safari/537.36"
                    ),
                    "Origin": settings.sp_base_url,
                    "Referer": settings.sp_login_page_url,
                },
                follow_redirects=True,
            )

            print(f"[SP-LOGIN] POST status: {response.status_code}")
            print(f"[SP-LOGIN] Final URL: {response.url}")
            print(f"[SP-LOGIN] Response snippet: {response.text[:500]}")

            # Check result
            final_url = str(response.url).lower()
            resp_html = response.text.lower()
            is_on_login_page = "youlogin" in final_url or (
                "login" in final_url and "template" not in final_url
            )
            has_login_form = 'id="login_form"' in resp_html

            # Build cookie header
            cookie_header = "; ".join(
                f"{k}={v}" for k, v in client.cookies.items()
            )

            if is_on_login_page and has_login_form:
                # Check for specific error messages
                body = response.text
                error_msg = "Login failed"
                if "invalid" in body.lower() and ("password" in body.lower() or "netid" in body.lower()):
                    error_msg = "Invalid NetID or password"
                elif "captcha" in body.lower() and ("mismatch" in body.lower() or "invalid" in body.lower()):
                    error_msg = "CAPTCHA verification failed"
                elif "too many" in body.lower():
                    error_msg = "Too many login attempts"

                # Include debug info in error response
                resp_snippet = response.text[:1000].replace("\n", " ")
                return LoginResponse(
                    success=False, status=401,
                    message=(
                        f"{error_msg} | "
                        f"url={str(response.url)} | "
                        f"captcha={captcha_text} | "
                        f"domain_field={domain_field}={domain_token if domain_field else 'N/A'} | "
                        f"captcha_field={captcha_field}={captcha_token if captcha_field else 'N/A'} | "
                        f"nonce={nonce} | "
                        f"honeypot={honeypot_name} | "
                        f"fields={list(form_data.keys())} | "
                        f"resp_snippet={resp_snippet}"
                    ),
                )

            # Build cookie header
            cookie_header = "; ".join(
                f"{k}={v}" for k, v in client.cookies.items()
            )

            if not cookie_header:
                return LoginResponse(
                    success=False, status=401,
                    message="No session cookies established",
                )

            print(f"[SP-LOGIN] Success! Cookie length: {len(cookie_header)}")
            return LoginResponse(
                success=True,
                status=200,
                message="Success",
                cookies=cookie_header,
            )

    def _extract_secure_config(self, html: str) -> dict[str, str]:
        """Extract all values from SECURE_CONFIG in the HTML."""
        result: dict[str, str] = {}

        # Pattern 1: SECURE_CONFIG.key = 'value' (property assignments)
        for match in re.finditer(
            r"SECURE_CONFIG\.(\w+)\s*=\s*['\"]([^'\"]+)['\"]", html
        ):
            result[match.group(1)] = match.group(2)

        # Pattern 2: Inside object literal: key: 'value' (after SECURE_CONFIG = {)
        obj_match = re.search(
            r"SECURE_CONFIG\s*=\s*\{([^}]+)\}", html, re.DOTALL
        )
        if obj_match:
            obj_body = obj_match.group(1)
            for match in re.finditer(
                r"(\w+)\s*:\s*['\"]([^'\"]+)['\"]", obj_body
            ):
                result[match.group(1)] = match.group(2)

        return result

    def _extract_honeypot_name(self, soup: BeautifulSoup) -> str | None:
        for inp in soup.find_all("input", attrs={"type": "text"}):
            name = inp.get("name", "")
            if re.match(r"^ph_[a-f0-9]+$", name):
                return name
        return None

    def _extract_hidden_value(self, soup: BeautifulSoup, field_id: str) -> str | None:
        inp = soup.find("input", attrs={"id": field_id})
        return inp.get("value") if inp else None

    def _extract_captcha_image_url(self, soup: BeautifulSoup) -> str | None:
        """Extract CAPTCHA image URL from data-src attribute."""
        img = soup.find("img", attrs={"id": "secure_captcha"})
        if img and img.get("data-src"):
            data_src = img["data-src"]
            if data_src.startswith("/"):
                return f"{settings.sp_base_url}{data_src}"
            return data_src
        return None

    def _compute_telemetry_payload(self) -> str:
        """Compute telemetryPayload (from secure2.js attachTelemetryToForm)."""
        import hashlib
        telemetry = json.dumps({
            "E": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/138.0.0.0 Safari/537.36"
            ),
            "D": 1920, "C": 1080, "B": -330,
            "z": 3, "y": 5, "x": 1, "w": 1500,
            "v": False,
            "u": hashlib.sha256(b"canvas-fingerprint").hexdigest(),
            "timeOnPageMs": 2000,
            "submitTime": int(time.time() * 1000),
        }, separators=(",", ":"))
        return base64.b64encode(telemetry.encode()).decode()

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
