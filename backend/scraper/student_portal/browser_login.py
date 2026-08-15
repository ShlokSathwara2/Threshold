from __future__ import annotations

import base64
import time
import uuid
from dataclasses import dataclass, field

from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page

from core.config import settings
from core.schemas.models import LoginResponse

_SESSION_TTL = 300  # seconds
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/138.0.0.0 Safari/537.36"
)


@dataclass
class _BrowserSession:
    browser: Browser
    context: BrowserContext
    page: Page
    created_at: float = field(default_factory=time.time)


_sessions: dict[str, _BrowserSession] = {}

_pw = None


def _get_playwright():
    global _pw
    if _pw is None:
        _pw = sync_playwright().start()
    return _pw


def _sweep_expired():
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v.created_at > _SESSION_TTL]
    for k in expired:
        _close_session(k)


def _close_session(session_id: str):
    s = _sessions.pop(session_id, None)
    if s is None:
        return
    try:
        s.page.close()
    except Exception:
        pass
    try:
        s.context.close()
    except Exception:
        pass
    try:
        s.browser.close()
    except Exception:
        pass


def start_login(username: str) -> dict:
    """Launch headless browser, load SRM login page, screenshot CAPTCHA."""
    _sweep_expired()

    netid = username.split("@")[0] if "@" in username else username
    print(f"[SP-LOGIN-INIT] Starting browser login for NetID: {netid}")

    pw = _get_playwright()
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(user_agent=_USER_AGENT)
    page = context.new_page()

    try:
        print(f"[SP-LOGIN-INIT] Navigating to {settings.sp_login_page_url}")
        page.goto(settings.sp_login_page_url, wait_until="networkidle", timeout=30000)
        print(f"[SP-LOGIN-INIT] Page loaded, URL: {page.url}")

        # Wait for CAPTCHA image to appear
        captcha_img = page.locator("img#secure_captcha")
        try:
            captcha_img.wait_for(state="visible", timeout=10000)
            print("[SP-LOGIN-INIT] CAPTCHA image found")
        except Exception:
            print("[SP-LOGIN-INIT] CAPTCHA image not found, trying data-src img")
            # Fallback: look for any captcha-related img
            captcha_img = page.locator("img[data-src*='aptcha'], img[src*='aptcha']")
            try:
                captcha_img.first.wait_for(state="visible", timeout=5000)
                captcha_img = captcha_img.first
                print("[SP-LOGIN-INIT] Fallback CAPTCHA image found")
            except Exception:
                print("[SP-LOGIN-INIT] No CAPTCHA image found, screenshotting full page")
                captcha_img = None

        # Screenshot the CAPTCHA element (or full page as fallback)
        if captcha_img:
            img_bytes = captcha_img.screenshot()
        else:
            img_bytes = page.screenshot()

        captcha_b64 = base64.b64encode(img_bytes).decode()
        print(f"[SP-LOGIN-INIT] CAPTCHA screenshot: {len(captcha_b64)} chars")

        session_id = uuid.uuid4().hex
        _sessions[session_id] = _BrowserSession(
            browser=browser,
            context=context,
            page=page,
        )
        print(f"[SP-LOGIN-INIT] Session {session_id} stored, browser kept alive")
        return {"success": True, "session_id": session_id, "captcha_image_base64": captcha_b64}

    except Exception as e:
        print(f"[SP-LOGIN-INIT] Error: {e}")
        # Clean up on error
        try:
            page.close()
        except Exception:
            pass
        try:
            context.close()
        except Exception:
            pass
        try:
            browser.close()
        except Exception:
            pass
        raise


def finish_login(session_id: str, username: str, password: str, captcha_answer: str) -> LoginResponse:
    """Resume the live browser session, fill form, submit, extract cookies."""
    session = _sessions.pop(session_id, None)
    if session is None:
        return LoginResponse(success=False, status=400, message="Session expired or invalid. Restart login.")
    if time.time() - session.created_at > _SESSION_TTL:
        _close_session(session_id)
        return LoginResponse(success=False, status=400, message="Session expired. Restart login.")

    page = session.page
    context = session.context
    browser = session.browser
    netid = username.split("@")[0] if "@" in username else username

    print(f"[SP-LOGIN-VERIFY] Resuming for NetID: {netid}, session {session_id}")

    try:
        # Fill username
        username_input = page.locator("input[name='username'], input[id='username'], input[type='text']").first
        username_input.fill(netid)
        print(f"[SP-LOGIN-VERIFY] Filled username: {netid}")

        # Fill password
        password_input = page.locator("input[name='password'], input[id='password'], input[type='password']").first
        password_input.fill(password)
        print("[SP-LOGIN-VERIFY] Filled password")

        # Fill CAPTCHA
        captcha_input = page.locator("input[name='captcha'], input[id='captcha']").first
        captcha_input.fill(captcha_answer)
        print(f"[SP-LOGIN-VERIFY] Filled captcha: {captcha_answer}")

        # Find and click submit button
        submit_btn = page.locator(
            "button[type='submit'], "
            "input[type='submit'], "
            "#login_form button, "
            "#login_form input[type='submit'], "
            "button:has-text('Login'), "
            "button:has-text('Sign In'), "
            "button:has-text('Log In')"
        ).first
        print("[SP-LOGIN-VERIFY] Clicking submit...")

        # Wait for navigation after submit
        with page.expect_navigation(timeout=15000, wait_until="networkidle"):
            submit_btn.click()

        final_url = page.url
        print(f"[SP-LOGIN-VERIFY] Final URL: {final_url}")

        # Check if still on login page (failure)
        resp_html = page.content().lower()
        is_on_login_page = "youlogin" in final_url.lower() or (
            "login" in final_url.lower() and "template" not in final_url.lower()
        )
        has_login_form = 'id="login_form"' in resp_html

        if is_on_login_page and has_login_form:
            # Extract error message if present
            error_msg = "Login failed"
            body_lower = resp_html
            if "invalid" in body_lower and ("password" in body_lower or "netid" in body_lower):
                error_msg = "Invalid NetID or password"
            elif "captcha" in body_lower and ("mismatch" in body_lower or "invalid" in body_lower):
                error_msg = "CAPTCHA verification failed"
            elif "too many" in body_lower:
                error_msg = "Too many login attempts"

            print(f"[SP-LOGIN-VERIFY] Login failed: {error_msg}")
            return LoginResponse(success=False, status=401, message=error_msg)

        # Extract cookies from the browser context
        cookies = context.cookies()
        cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
        print(f"[SP-LOGIN-VERIFY] Extracted {len(cookies)} cookies, header length: {len(cookie_header)}")

        if not cookie_header:
            return LoginResponse(success=False, status=401, message="No session cookies established")

        print(f"[SP-LOGIN-VERIFY] Success!")
        return LoginResponse(success=True, status=200, message="Success", cookies=cookie_header)

    except Exception as e:
        print(f"[SP-LOGIN-VERIFY] Error: {e}")
        return LoginResponse(success=False, status=500, message=f"Login error: {e}")

    finally:
        # Always close browser to avoid leaking processes
        try:
            page.close()
        except Exception:
            pass
        try:
            context.close()
        except Exception:
            pass
        try:
            browser.close()
        except Exception:
            pass
        print(f"[SP-LOGIN-VERIFY] Browser closed for session {session_id}")
