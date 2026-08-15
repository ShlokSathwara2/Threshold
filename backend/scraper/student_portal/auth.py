from __future__ import annotations

from playwright.sync_api import sync_playwright, Page, BrowserContext

from core.config import settings
from core.schemas.models import LoginResponse


class StudentPortalAuth:
    """Handle login and session management with SRM Student Portal using Playwright."""

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
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/138.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            try:
                return self._attempt_login(page, context, netid, password)
            finally:
                browser.close()

    def _attempt_login(
        self, page: Page, context: BrowserContext, netid: str, password: str
    ) -> LoginResponse:
        # Step 1: Navigate to login page
        print(f"[SP-LOGIN] Loading login page: {settings.sp_login_page_url}")
        page.goto(settings.sp_login_page_url, wait_until="networkidle", timeout=30000)

        # Wait for the login form
        page.wait_for_selector("#login_form", timeout=10000)
        print("[SP-LOGIN] Login page loaded")

        # Step 2: Extract CAPTCHA text from SECURE_CONFIG (page JS variable)
        captcha_text = page.evaluate("() => window.SECURE_CONFIG?.captchaText")
        print(f"[SP-LOGIN] CAPTCHA: {captcha_text}")

        if not captcha_text:
            return LoginResponse(
                success=False, status=500,
                message="Could not extract CAPTCHA from login page",
            )

        # Step 3: Fill the form
        # Playwright fills inputs directly — JS (guardlogin.js, secure2.js)
        # will auto-generate all security tokens (domainFieldName,
        # captchaFieldName, fpPayload, fpToken, telemetryPayload) on submit.
        page.fill("#username", netid)
        page.fill("#password", password)
        page.fill("#captcha", captcha_text)
        print("[SP-LOGIN] Form filled")

        # Step 4: Submit — JS generates tokens and the form is sent
        print("[SP-LOGIN] Submitting form...")
        with page.expect_navigation(timeout=15000, wait_until="networkidle"):
            page.click("#btnLogin")

        # Step 5: Check where we ended up
        final_url = page.url.lower()
        print(f"[SP-LOGIN] Final URL: {page.url}")

        if "youlogin" in final_url or ("login" in final_url and "template" not in final_url):
            # Still on login page — find error
            body_text = (page.text_content("body") or "").lower()
            if "invalid" in body_text and ("password" in body_text or "netid" in body_text):
                return LoginResponse(
                    success=False, status=401,
                    message="Invalid NetID or password",
                )
            return LoginResponse(
                success=False, status=401,
                message="Login failed — still on login page",
            )

        # Step 6: Extract cookies
        all_cookies = context.cookies()
        cookie_header = "; ".join(
            f"{c['name']}={c['value']}"
            for c in all_cookies
            if c.get("domain", "").endswith("srmist.edu.in")
        )
        print(f"[SP-LOGIN] Extracted {len(all_cookies)} cookies")

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

    def logout(self, cookie: str) -> dict:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            context = browser.new_context()
            for pair in cookie.split(";"):
                if "=" in pair:
                    k, v = pair.strip().split("=", 1)
                    context.add_cookies([{
                        "name": k.strip(),
                        "value": v.strip(),
                        "domain": "sp.srmist.edu.in",
                        "path": "/",
                    }])
            page = context.new_page()
            try:
                resp = page.goto(
                    f"{settings.sp_base_url}{settings.sp_context_path}/Logout",
                    wait_until="networkidle",
                    timeout=15000,
                )
                return {
                    "status": resp.status if resp else 500,
                    "success": resp is not None and resp.status in {200, 302},
                }
            finally:
                browser.close()
